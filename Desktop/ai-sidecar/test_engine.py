import pytest
from fuzzy_engine import evaluate

def test_rule_f1_high_risk():
    res = evaluate(paste_typing_mismatch=9.0, paste_source_trust=9.0, window_switch_pattern=1.0)
    assert res['level'] == 'High'
    assert 'F1' in res['rules_fired'] or 'F2' in res['rules_fired'] or 'F9' in res['rules_fired']

def test_rule_f3_medium_risk():
    res = evaluate(paste_typing_mismatch=9.0, paste_source_trust=1.0, window_switch_pattern=1.0)
    assert res['level'] == 'Medium'

def test_rule_f5_low_risk():
    res = evaluate(paste_typing_mismatch=1.0, paste_source_trust=1.0, window_switch_pattern=1.0)
    assert res['level'] == 'Low'

def test_rule_f6_frequent_unclear_switching():
    res = evaluate(paste_typing_mismatch=1.0, paste_source_trust=1.0, window_switch_pattern=9.0)
    assert res['level'] in ['Medium', 'High']

def test_rule_f9_worst_case_combo():
    res = evaluate(paste_typing_mismatch=9.5, paste_source_trust=9.5, window_switch_pattern=9.5)
    assert res['level'] == 'High'
    assert res['score'] >= 6.5
