"""
PROCTR — Fuzzy AI Microservice API
===================================
Flask sidecar server wrapping fuzzy_engine.py.
Receives telemetry evaluation requests from the desktop app / host service.
"""

from flask import Flask, request, jsonify
from fuzzy_engine import evaluate

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'service': 'PROCTR Fuzzy AI Sidecar',
        'version': '1.0.0'
    }), 200

@app.route('/evaluate', methods=['POST'])
def evaluate_endpoint():
    data = request.get_json() or {}
    
    # Extract inputs with defaults
    paste_mismatch = data.get('paste_typing_mismatch', 0.0)
    source_trust   = data.get('paste_source_trust', 0.0)
    window_switch  = data.get('window_switch_pattern', 0.0)
    student_id     = data.get('student_id')
    exam_id        = data.get('exam_id')

    try:
        ptm = float(paste_mismatch)
        pst = float(source_trust)
        wsp = float(window_switch)
    except (ValueError, TypeError):
        return jsonify({
            'status': 'error',
            'message': 'Invalid input parameters. Numerical values required for inputs.'
        }), 400

    result = evaluate(ptm, pst, wsp)
    
    response = {
        'status': 'success',
        'exam_id': exam_id,
        'student_id': student_id,
        'evaluation': result
    }
    
    return jsonify(response), 200

if __name__ == '__main__':
    # Default port 5050 for PROCTR Fuzzy AI sidecar
    app.run(host='127.0.0.1', port=5050, debug=True)
