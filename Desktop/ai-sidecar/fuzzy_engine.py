"""
PROCTR — Fuzzy AI Engine
=========================
Evaluates ambiguous student behaviour during lab exams using
scikit-fuzzy.  Only handles the genuinely-ambiguous signals;
hard violations (USB, blocked sites, etc.) are flagged instantly
by the desktop client and never pass through this module.

Inputs  (all scored 0–10 by the desktop client)
─────────────────────────────────────────────────
  paste_typing_mismatch   — how much pasted code exceeds typed code
  paste_source_trust      — whether the paste came from inside the workspace
  window_switch_pattern   — frequency + clarity of window switching

Output
──────
  risk_level  0–10  → mapped to Low / Medium / High
"""

import numpy as np
import skfuzzy as fuzz
from skfuzzy import control as ctrl


# ── Universe of discourse (0-10 for all variables) ──────────────────

paste_mismatch = ctrl.Antecedent(np.arange(0, 10.01, 0.1), "paste_typing_mismatch")
source_trust   = ctrl.Antecedent(np.arange(0, 10.01, 0.1), "paste_source_trust")
window_switch  = ctrl.Antecedent(np.arange(0, 10.01, 0.1), "window_switch_pattern")
risk_level     = ctrl.Consequent(np.arange(0, 10.01, 0.1), "risk_level")


# ── Membership functions ────────────────────────────────────────────

# paste_typing_mismatch
paste_mismatch["consistent"]        = fuzz.trapmf(paste_mismatch.universe, [0, 0, 1.5, 3])
paste_mismatch["suspicious"]        = fuzz.trimf(paste_mismatch.universe,  [2, 5, 7])
paste_mismatch["highly_suspicious"] = fuzz.trapmf(paste_mismatch.universe, [5, 7, 10, 10])

# paste_source_trust  (low number = trusted, high = untrusted)
source_trust["trusted"]   = fuzz.trapmf(source_trust.universe, [0, 0, 2, 4])
source_trust["untrusted"] = fuzz.trapmf(source_trust.universe, [4, 6, 10, 10])

# window_switch_pattern
window_switch["normal"]           = fuzz.trapmf(window_switch.universe, [0, 0, 2, 4])
window_switch["frequent_trusted"] = fuzz.trimf(window_switch.universe,  [3, 5, 7])
window_switch["frequent_unclear"] = fuzz.trapmf(window_switch.universe, [5, 7, 10, 10])

# risk_level output
risk_level["low"]    = fuzz.trimf(risk_level.universe, [0, 0, 4])
risk_level["medium"] = fuzz.trimf(risk_level.universe, [3, 5, 7])
risk_level["high"]   = fuzz.trimf(risk_level.universe, [6, 10, 10])

# ── Rule base (F1-F9 from the PROCTR spec) ──────────────────────────

rule_f1 = ctrl.Rule(paste_mismatch["highly_suspicious"] & source_trust["untrusted"], risk_level["high"])
rule_f1.label = "F1"

rule_f2 = ctrl.Rule(paste_mismatch["suspicious"] & source_trust["untrusted"], risk_level["high"])
rule_f2.label = "F2"

rule_f3 = ctrl.Rule(paste_mismatch["highly_suspicious"] & source_trust["trusted"], risk_level["medium"])
rule_f3.label = "F3"

rule_f4 = ctrl.Rule(paste_mismatch["suspicious"] & source_trust["trusted"], risk_level["low"])
rule_f4.label = "F4"

rule_f5 = ctrl.Rule(paste_mismatch["consistent"], risk_level["low"])
rule_f5.label = "F5"

rule_f6 = ctrl.Rule(window_switch["frequent_unclear"], risk_level["medium"])
rule_f6.label = "F6"

rule_f7 = ctrl.Rule(window_switch["frequent_trusted"], risk_level["low"])
rule_f7.label = "F7"

rule_f8 = ctrl.Rule(window_switch["normal"], risk_level["low"])
rule_f8.label = "F8"

rule_f9 = ctrl.Rule(
    paste_mismatch["highly_suspicious"] & source_trust["untrusted"] & window_switch["frequent_unclear"],
    risk_level["high"],
)
rule_f9.label = "F9"

_all_rules = [rule_f1, rule_f2, rule_f3, rule_f4, rule_f5, rule_f6, rule_f7, rule_f8, rule_f9]
_system = ctrl.ControlSystem(_all_rules)

_REASON_TEMPLATES = {
    "F1": "Large block of code was pasted with no prior typing, and the source could not be traced to the student's own workspace.",
    "F2": "Pasted code exceeds what the student actually typed, and the paste source is untraceable.",
    "F3": "Large untyped paste detected, but it originated from the student's own earlier file in the workspace.",
    "F4": "Paste is slightly larger than typed content, but the source is the student's own trusted work.",
    "F5": "Code typed by the student matches what is in the editor -- no unexplained paste detected.",
    "F6": "Student switched windows frequently to destinations the system cannot identify.",
    "F7": "Frequent window switching observed, but always to the student's own notes or scratch files.",
    "F8": "Normal amount of window switching; student mostly stayed on the exam workspace.",
    "F9": "Large untraceable paste combined with frequent switching to unidentified windows -- strongest indicator of external assistance.",
}

def evaluate(paste_typing_mismatch: float,
             paste_source_trust: float,
             window_switch_pattern: float) -> dict:
    ptm = float(np.clip(paste_typing_mismatch, 0, 10))
    pst = float(np.clip(paste_source_trust, 0, 10))
    wsp = float(np.clip(window_switch_pattern, 0, 10))

    sim = ctrl.ControlSystemSimulation(_system)
    sim.input["paste_typing_mismatch"] = ptm
    sim.input["paste_source_trust"] = pst
    sim.input["window_switch_pattern"] = wsp

    try:
        sim.compute()
        score = float(sim.output["risk_level"])
    except Exception:
        score = 0.0

    # Evaluate membership of input values directly
    pm_cons  = float(fuzz.interp_membership(paste_mismatch.universe, paste_mismatch["consistent"].mf, ptm))
    pm_susp  = float(fuzz.interp_membership(paste_mismatch.universe, paste_mismatch["suspicious"].mf, ptm))
    pm_hsusp = float(fuzz.interp_membership(paste_mismatch.universe, paste_mismatch["highly_suspicious"].mf, ptm))

    st_trust   = float(fuzz.interp_membership(source_trust.universe, source_trust["trusted"].mf, pst))
    st_untrust = float(fuzz.interp_membership(source_trust.universe, source_trust["untrusted"].mf, pst))

    ws_norm   = float(fuzz.interp_membership(window_switch.universe, window_switch["normal"].mf, wsp))
    ws_ftrust = float(fuzz.interp_membership(window_switch.universe, window_switch["frequent_trusted"].mf, wsp))
    ws_func   = float(fuzz.interp_membership(window_switch.universe, window_switch["frequent_unclear"].mf, wsp))

    fired_map = {
        "F1": min(pm_hsusp, st_untrust),
        "F2": min(pm_susp, st_untrust),
        "F3": min(pm_hsusp, st_trust),
        "F4": min(pm_susp, st_trust),
        "F5": pm_cons,
        "F6": ws_func,
        "F7": ws_ftrust,
        "F8": ws_norm,
        "F9": min(pm_hsusp, st_untrust, ws_func),
    }

    fired = [k for k, v in fired_map.items() if v > 0.1]

    # Map numeric score to risk level label
    if score >= 5.5 or "F9" in fired or "F1" in fired or "F2" in fired:
        level = "High"
    elif score >= 3.0 or "F3" in fired or "F6" in fired:
        level = "Medium"
    else:
        level = "Low"

    if fired:
        # Pick highest-priority fired rule for reason text
        priority = ["F9", "F1", "F2", "F3", "F6", "F4", "F7", "F5", "F8"]
        primary = next((r for r in priority if r in fired), fired[0])
        reason = _REASON_TEMPLATES.get(primary, "Ambiguous behaviour detected.")
    else:
        reason = "No significant anomalies detected."

    return {
        "score": round(score, 2),
        "level": level,
        "reason": reason,
        "rules_fired": fired,
    }


def _get_rule_strength(rule, ptm, pst, wsp):
    """Approximate the firing strength of a rule by checking antecedent MF values."""
    strengths = []
    for term in rule.antecedent_terms:
        var_name = term.term.parent.label
        if var_name == "paste_typing_mismatch":
            val = fuzz.interp_membership(paste_mismatch.universe,
                                         term.term.mf, ptm)
        elif var_name == "paste_source_trust":
            val = fuzz.interp_membership(source_trust.universe,
                                         term.term.mf, pst)
        elif var_name == "window_switch_pattern":
            val = fuzz.interp_membership(window_switch.universe,
                                         term.term.mf, wsp)
        else:
            val = 0.0
        strengths.append(val)
    # AND connector → minimum
    return min(strengths) if strengths else 0.0


# ── Quick self-test ─────────────────────────────────────────────────

if __name__ == "__main__":
    test_cases = [
        # (ptm, pst, wsp, expected_level)
        (9.0, 9.0, 2.0, "High"),   # F1: big paste, untrusted, normal switching
        (5.0, 8.0, 2.0, "High"),   # F2: moderate paste, untrusted
        (9.0, 1.0, 2.0, "Medium"), # F3: big paste, but from own workspace
        (5.0, 1.0, 2.0, "Low"),    # F4: slight paste, trusted source
        (1.0, 1.0, 1.0, "Low"),    # F5: consistent typing
        (1.0, 1.0, 9.0, "Medium"), # F6: frequent unclear switching
        (1.0, 1.0, 5.0, "Low"),    # F7: frequent but trusted switching
        (1.0, 1.0, 1.0, "Low"),    # F8: normal switching
        (9.0, 9.0, 9.0, "High"),   # F9: worst-case combo
    ]

    print("PROCTR Fuzzy AI Engine -- Self-Test")
    print("=" * 60)
    for i, (ptm, pst, wsp, expected) in enumerate(test_cases, 1):
        result = evaluate(ptm, pst, wsp)
        status = "[OK]" if result["level"] == expected else "[FAIL]"
        print(f"  F{i}  inputs=({ptm},{pst},{wsp})  "
              f"score={result['score']:5.2f}  level={result['level']:6s}  "
              f"expected={expected:6s}  {status}")
        if result["level"] != expected:
            print(f"       MISMATCH -- rules_fired={result['rules_fired']}")
    print("=" * 60)
    print("Done.")
