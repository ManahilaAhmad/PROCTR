# PROCTR — Fuzzy AI Sidecar

Standalone Python microservice using `scikit-fuzzy` to evaluate ambiguous student activity during lab exams.

## Purpose
Evaluates ambiguous telemetry metrics captured during an exam:
1. `paste_typing_mismatch`: ratio of pasted code vs typed code in VS Code
2. `paste_source_trust`: whether paste originated within workspace or external source
3. `window_switch_pattern`: frequency and clarity of window switching

Returns a score (0–10), risk level (`Low`, `Medium`, `High`), plain-language explanation, and triggered rules.

## Installation & Running

```bash
# Install dependencies
pip install -r requirements.txt

# Run self-test
python fuzzy_engine.py

# Run tests
pytest test_engine.py

# Launch HTTP sidecar (runs on http://127.0.0.1:5050)
python app.py
```

## API Specification

### `POST /evaluate`
Payload:
```json
{
  "paste_typing_mismatch": 8.5,
  "paste_source_trust": 9.0,
  "window_switch_pattern": 3.0,
  "student_id": 12,
  "exam_id": 4
}
```

Response:
```json
{
  "status": "success",
  "exam_id": 4,
  "student_id": 12,
  "evaluation": {
    "score": 8.45,
    "level": "High",
    "reason": "Large block of code was pasted with no prior typing, and the source could not be traced to the student's own workspace.",
    "rules_fired": ["F1", "F2"]
  }
}
```
