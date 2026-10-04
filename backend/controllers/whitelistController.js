import pool from '../db.js';

// Curated starter list of 5 domain suggestions (can be expanded later)
const SUGGESTED_DOMAINS = [
  'docs.python.org',
  'developer.mozilla.org',
  'w3schools.com',
  'postgresql.org',
  'stackoverflow.com'
];

/* ===========================================================
   GET WHITELIST FOR AN EXAM
=========================================================== */
export const getExamWhitelist = async (req, res) => {
  const { examId } = req.params;
  try {
    const result = await pool.query(`
      SELECT whitelist_id, domain, created_at
      FROM exam_whitelist
      WHERE exam_id = $1
      ORDER BY created_at ASC
    `, [examId]);

    res.status(200).json({ status: 'success', whitelist: result.rows });
  } catch (error) {
    console.error('Error fetching whitelist:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch domain whitelist.' });
  }
};

/* ===========================================================
   ADD DOMAIN TO EXAM WHITELIST
=========================================================== */
export const addDomainToWhitelist = async (req, res) => {
  const { examId } = req.params;
  const { domain } = req.body;

  if (!domain || !domain.trim()) {
    return res.status(400).json({ status: 'error', message: 'Domain string is required.' });
  }

  // Clean domain input (remove protocol or path if user pasted full URL)
  let cleanDomain = domain.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');

  if (cleanDomain.length > 253 || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(cleanDomain)) {
    return res.status(400).json({ status: 'error', message: 'Enter a valid domain name without a path or wildcard.' });
  }

  try {
    const tRes = await pool.query('SELECT teacher_id FROM teacher WHERE user_id = $1', [req.sessionUser.sub]);
    const teacherId = req.sessionUser.role === 'admin'
      ? (await pool.query('SELECT teacher_id FROM exam WHERE exam_id=$1', [examId])).rows[0]?.teacher_id
      : tRes.rows[0]?.teacher_id;
    if (!teacherId) return res.status(403).json({ status: 'error', message: 'A valid teacher profile is required.' });

    const result = await pool.query(`
      INSERT INTO exam_whitelist (exam_id, domain, added_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (exam_id, domain) DO NOTHING
      RETURNING *
    `, [examId, cleanDomain, teacherId]);

    res.status(201).json({ status: 'success', entry: result.rows[0] || { domain: cleanDomain } });
  } catch (error) {
    console.error('Error adding to whitelist:', error);
    res.status(500).json({ status: 'error', message: 'Failed to add domain to whitelist.' });
  }
};

/* ===========================================================
   REMOVE DOMAIN FROM EXAM WHITELIST
=========================================================== */
export const removeDomainFromWhitelist = async (req, res) => {
  const { examId, whitelistId } = req.params;
  try {
    await pool.query(`
      DELETE FROM exam_whitelist
      WHERE exam_id = $1 AND whitelist_id = $2
    `, [examId, whitelistId]);

    res.status(200).json({ status: 'success', message: 'Domain removed from whitelist.' });
  } catch (error) {
    console.error('Error removing from whitelist:', error);
    res.status(500).json({ status: 'error', message: 'Failed to remove domain from whitelist.' });
  }
};

/* ===========================================================
   AUTOCOMPLETE DOMAIN SUGGESTIONS
=========================================================== */
export const getDomainSuggestions = async (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase();

  if (!query) {
    return res.status(200).json({ status: 'success', suggestions: SUGGESTED_DOMAINS });
  }

  const matches = SUGGESTED_DOMAINS.filter(d => d.includes(query));
  res.status(200).json({ status: 'success', suggestions: matches });
};
