/**
 * Exhaustive Search Test for Medical Insurance Eligibility Logic
 * This script simulates all possible paths in the logicTree to ensure:
 * 1. Every path leads to a terminal result node.
 * 2. No undefined nodes are referenced.
 * 3. Boundary values for T-scores and dates are handled.
 */

// Mock state
let appMode = 'bone';
let answers = {};

// Helper functions (Copied from script.js)
const formatD = (d) => `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`;
const getTodayStr = () => formatD(new Date());

function branchByProliaType() {
  if (answers.proliaType === 'general') {
    return "prolia_frac_1";
  } else {
    return autoEvalSteroidScore();
  }
}

function autoEvalNormalScores() {
  const score = answers.proliaQ2;
  if (score <= -2.5) return "prolia_res_C";
  if (score > -2.5 && score <= -2.0) return "prolia_q8_1"; 
  return "prolia_res_E";
}

function autoEvalSteroidScore() {
  const score = answers.proliaQ2;
  if (answers.giopAge === 'adult') {
    if (score < -1.5) return "prolia_res_B";
    return "prolia_res_E";
  } else {
    if (score < -3.0) return "prolia_res_B";
    return "prolia_res_E";
  }
}

function routeDiagnosis() {
  if (answers.ageGroup === 'senior') return "result_diag_eligible";
  if (answers.ageGroup === 'teen') return "teen_disease";
  if (answers.gender === 'F' && answers.ageGroup === 'adult') return "f_preg_diag";
  return "m_frac";
}

function checkFollowUpRouting() {
  if (answers.ageGroup === 'teen') return "teen_zscore";
  if (answers.gender === 'F' && answers.ageGroup === 'adult') return "f_fu_preg";
  return "fu_tscore";
}

// Result placeholder functions
const renderSimpleResult = () => "result";
const renderProliaResult = () => "result";
const renderProliaHojeon = () => "hojeon";
const calcFollowUpResult = () => "fu_result";

// The Logic Tree (Extracted from script.js)
const logicTree = {
  root: {
    options: [
      { label: "골밀도검사(BMD)", action: () => { appMode = 'bone'; return 'start'; } },
      { label: "프롤리아 프리필드시린지", action: () => { appMode = 'prolia'; return 'prolia_q1_purpose'; } }
    ]
  },
  prolia_q1_purpose: {
    options: [
      { label: "일반", action: () => { answers.proliaType = 'general'; return "prolia_q2_date"; } },
      { label: "GIOP", action: () => { answers.proliaType = 'giop'; return "prolia_steroid_chk"; } }
    ]
  },
  prolia_steroid_chk: {
    type: "checkboxes_steroid",
    action: (is90, is450) => (is90 && is450) ? "prolia_q1_giop_type" : "prolia_res_E_steroid_cond"
  },
  prolia_q1_giop_type: {
    options: [
      { label: "Adult", action: () => { answers.giopAge = 'adult'; return "prolia_q2_date"; } },
      { label: "Young", action: () => { answers.giopAge = 'young'; return "prolia_q2_date"; } }
    ]
  },
  prolia_q2_date: {
    type: "date",
    action: (val) => {
      answers.proliaQ1Date = val;
      const bmdDate = new Date(val);
      const today = new Date();
      const diffDays = (today - bmdDate) / (1000 * 60 * 60 * 24);
      if (diffDays > 365.25) return "prolia_res_E_date_expired";
      return (answers.proliaType === 'giop' && answers.giopAge === 'young') ? "prolia_q3_score_z" : "prolia_q3_score_t";
    }
  },
  prolia_q3_score_t: {
    type: "number",
    action: (val) => { answers.proliaQ2 = parseFloat(val); return "prolia_q4_has_history"; }
  },
  prolia_q3_score_z: {
    type: "number",
    action: (val) => { answers.proliaQ2 = parseFloat(val); return "prolia_q4_has_history"; }
  },
  prolia_q4_has_history: {
    options: [
      { label: "Yes", action: () => "prolia_q4_date" },
      { label: "No", action: () => { answers.proliaQ3 = null; return branchByProliaType(); } }
    ]
  },
  prolia_q4_date: {
    type: "date",
    action: (val) => { answers.proliaQ3 = val; return branchByProliaType(); }
  },
  prolia_frac_1: {
    options: [
      { label: "Yes", action: () => "prolia_frac_2" },
      { label: "No", action: () => autoEvalNormalScores() }
    ]
  },
  prolia_frac_2: {
    options: [
      { label: "Yes", action: () => "prolia_res_A" },
      { label: "No", action: () => autoEvalNormalScores() }
    ]
  },
  prolia_q8_1: {
    options: [
      { label: "Yes", action: () => "prolia_q8_2" },
      { label: "No", action: () => "prolia_res_E_new_patient" }
    ]
  },
  prolia_q8_2: {
    options: [
      { label: "Yes", action: () => "prolia_q11" },
      { label: "No", action: () => "prolia_res_E_start_invalid" }
    ]
  },
  prolia_q11: {
    options: [
      { label: "0", action: () => { answers.proliaCount = 0; return "prolia_res_D"; } },
      { label: "1", action: () => { answers.proliaCount = 1; return "prolia_res_D"; } },
      { label: "2", action: () => { answers.proliaCount = 2; return "prolia_res_D"; } },
      { label: "3", action: () => { answers.proliaCount = 3; return "prolia_res_D"; } },
      { label: "4", action: () => { answers.proliaCount = 4; return "prolia_res_E_limit"; } }
    ]
  },
  prolia_res_A: { isResult: true },
  prolia_res_B: { isResult: true },
  prolia_res_C: { isResult: true },
  prolia_res_D: { isResult: true },
  prolia_res_E: { isResult: true },
  prolia_res_E_new_patient: { isResult: true },
  prolia_res_E_start_invalid: { isResult: true },
  prolia_res_E_steroid_cond: { isResult: true },
  prolia_res_E_limit: { isResult: true },
  prolia_res_E_date_expired: { isResult: true },

  // BMD Flow
  start: {
    options: [
      { label: "F", action: () => { answers.gender = 'F'; return "age_f"; } },
      { label: "M", action: () => { answers.gender = 'M'; return "age_m"; } }
    ]
  },
  age_f: {
    options: [
      { label: "65+", action: () => { answers.ageGroup = 'senior'; return "purpose"; } },
      { label: "Adult", action: () => { answers.ageGroup = 'adult'; return "purpose"; } },
      { label: "Teen", action: () => { answers.ageGroup = 'teen'; return "purpose"; } },
      { label: "Child", action: () => "result_not_eligible_age" }
    ]
  },
  age_m: {
    options: [
      { label: "70+", action: () => { answers.ageGroup = 'senior'; return "purpose"; } },
      { label: "Adult", action: () => { answers.ageGroup = 'adult'; return "purpose"; } },
      { label: "Teen", action: () => { answers.ageGroup = 'teen'; return "purpose"; } },
      { label: "Child", action: () => "result_not_eligible_age" }
    ]
  },
  purpose: {
    options: [
      { label: "No", action: () => routeDiagnosis() },
      { label: "Yes", action: () => "fu_date" }
    ]
  },
  f_preg_diag: {
    options: [
      { label: "Y", action: () => "result_diag_eligible" },
      { label: "N", action: () => "f_meno" }
    ]
  },
  f_meno: {
    options: [
      { label: "Y", action: () => "f_bmi" },
      { label: "N", action: () => "f_amen" }
    ]
  },
  f_bmi: {
    options: [
      { label: "Y", action: () => "result_diag_eligible" },
      { label: "N", action: () => "f_frac" }
    ]
  },
  f_frac: {
    options: [
      { label: "Y", action: () => "result_diag_eligible" },
      { label: "N", action: () => "f_fam" }
    ]
  },
  f_fam: {
    options: [
      { label: "Y", action: () => "result_diag_eligible" },
      { label: "N", action: () => "f_surg" }
    ]
  },
  f_surg: {
    options: [
      { label: "Y", action: () => "result_diag_eligible" },
      { label: "N", action: () => "f_early" }
    ]
  },
  f_early: {
    options: [
      { label: "Y", action: () => "result_diag_eligible" },
      { label: "N", action: () => "common_disease" }
    ]
  },
  f_amen: {
    options: [
      { label: "Y", action: () => "result_diag_eligible" },
      { label: "N", action: () => "f_frac_pre" }
    ]
  },
  f_frac_pre: {
    options: [
      { label: "Y", action: () => "result_diag_eligible" },
      { label: "N", action: () => "common_disease" }
    ]
  },
  m_frac: {
    options: [
      { label: "Y", action: () => "result_diag_eligible" },
      { label: "N", action: () => "common_disease" }
    ]
  },
  common_disease: {
    options: [
      { label: "Y", action: () => "result_diag_eligible" },
      { label: "N", action: () => "common_drug" }
    ]
  },
  common_drug: {
    options: [
      { label: "Y", action: () => "result_diag_eligible" },
      { label: "N", action: () => "common_must" }
    ]
  },
  common_must: {
    options: [
      { label: "Y", action: () => "result_diag_eligible" },
      { label: "N", action: () => "result_not_eligible" }
    ]
  },
  teen_disease: {
    options: [
      { label: "Y", action: () => "result_diag_teen" },
      { label: "N", action: () => "teen_drug" }
    ]
  },
  teen_drug: {
    options: [
      { label: "Y", action: () => "result_diag_teen" },
      { label: "N", action: () => "teen_must" }
    ]
  },
  teen_must: {
    options: [
      { label: "Y", action: () => "result_diag_teen" },
      { label: "N", action: () => "result_not_eligible" }
    ]
  },
  fu_date: {
    type: "date",
    action: (val) => { answers.lastDate = val; return checkFollowUpRouting(); }
  },
  f_fu_preg: {
    options: [
      { label: "Y", action: () => { answers.intervalCode = 'preg'; return "result_fu_calc"; } },
      { label: "N", action: () => "fu_tscore" }
    ]
  },
  fu_tscore: {
    options: [
      { label: "Normal", action: () => { answers.tscore = 'normal'; return "fu_steroid"; } },
      { label: "Osteopenia", action: () => { answers.intervalCode = 'other'; return "result_fu_calc"; } },
      { label: "Osteoporosis", action: () => { answers.tscore = 'severe'; return "fu_steroid"; } }
    ]
  },
  fu_steroid: {
    options: [
      { label: "Y", action: () => { answers.exception = true; return "result_fu_calc"; } },
      { label: "N", action: () => "fu_pth" }
    ]
  },
  fu_pth: {
    options: [
      { label: "Y", action: () => { answers.exception = true; return "result_fu_calc"; } },
      { label: "N", action: () => { answers.exception = false; return "result_fu_calc"; } }
    ]
  },
  teen_zscore: {
    options: [
      { label: "Normal", action: () => { answers.intervalCode = 'teen_high'; return "result_fu_calc"; } },
      { label: "Abrnormal", action: () => { answers.intervalCode = 'teen_low'; return "result_fu_calc"; } }
    ]
  },
  result_not_eligible_age: { isResult: true },
  result_not_eligible: { isResult: true },
  result_diag_eligible: { isResult: true },
  result_diag_teen: { isResult: true },
  result_fu_calc: { isResult: true }
};

// Test Runner
const pathsCount = { total: 0, successful: 0, failed: 0 };
const errors = [];

function traverse(nodeId, path = []) {
  const node = logicTree[nodeId];
  if (!node) {
    errors.push(`Error: Node "${nodeId}" not found. Path: ${path.join(" -> ")}`);
    pathsCount.failed++;
    return;
  }

  if (node.isResult) {
    pathsCount.successful++;
    pathsCount.total++;
    return;
  }

  const currentPath = [...path, nodeId];

  if (node.options) {
    node.options.forEach(opt => {
      // Save state
      const savedAnswers = JSON.parse(JSON.stringify(answers));
      const savedMode = appMode;
      
      const nextId = opt.action();
      traverse(nextId, currentPath);
      
      // Restore state
      answers = savedAnswers;
      appMode = savedMode;
    });
  } else if (node.type === "date") {
    // Test today and 2 years ago
    const testDates = [
      new Date().toISOString().split('T')[0],
      new Date(Date.now() - 2 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    ];
    testDates.forEach(d => {
      const savedAnswers = JSON.parse(JSON.stringify(answers));
      const nextId = node.action(d);
      traverse(nextId, currentPath);
      answers = savedAnswers;
    });
  } else if (node.type === "number") {
    // Test boundary values
    const testScores = [-3.0, -2.5, -2.4, -2.0, -1.9, -1.0, 0];
    testScores.forEach(s => {
      const savedAnswers = JSON.parse(JSON.stringify(answers));
      const nextId = node.action(s);
      traverse(nextId, currentPath);
      answers = savedAnswers;
    });
  } else if (node.type === "checkboxes_steroid") {
    // Test all 4 combinations
    [[false, false], [true, false], [false, true], [true, true]].forEach(([is90, is450]) => {
      const savedAnswers = JSON.parse(JSON.stringify(answers));
      const nextId = node.action(is90, is450);
      traverse(nextId, currentPath);
      answers = savedAnswers;
    });
  }
}

console.log("Starting Exhaustive Decision Tree Test...");
traverse("root");
console.log("\n--- Test Results ---");
console.log(`Total Paths Traversed: ${pathsCount.total}`);
console.log(`Successful Terminations: ${pathsCount.successful}`);
console.log(`Failed Terminations: ${pathsCount.failed}`);

if (errors.length > 0) {
  console.log("\n--- Errors Found ---");
  errors.forEach(err => console.error(err));
  process.exit(1);
} else {
  console.log("\n✅ All paths terminated correctly.");
}
