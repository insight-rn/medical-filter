let appMode = 'bone';
let answers = {};
let historyStack = [];
let currentStep = "root";
let currentResultStatus = ""; // 결과 상태 저장을 위한 변수

const logicTree = {
  // --- 최상위 분기 ---
  root: {
    text: "다음 중 어떤 급여 기준을 확인하시겠습니까?",
    options: [
      { label: "골밀도검사(BMD)", action: () => { appMode = 'bone'; return 'start'; } },
      { label: "프롤리아 프리필드시린지 (Denosumab 주사제)", disabled: true, action: () => { appMode = 'prolia'; return 'prolia_q1_purpose'; } }
    ]
  },

  // ============================================
  // 프롤리아 프리필드시린지 라우팅 (Prolia)
  // ============================================
  prolia_q1_purpose: {
    text: "1. 환자의 프롤리아 투여 대상 기준은 무엇입니까?",
    options: [
      { label: "일반 골다공증 대상자", action: () => { answers.proliaType = 'general'; return "prolia_q2_date"; } },
      { label: "글루코코르티코이드(스테로이드) 유발 골다공증 대상자", action: () => { answers.proliaType = 'giop'; return "prolia_steroid_chk"; } }
    ]
  },
  prolia_steroid_chk: {
    type: "checkboxes_steroid",
    text: "최근 6개월간 글루코코르티코이드(스테로이드)를 투여받은 환자인가요?",
    info: "※ 요양급여를 인정받기 위해서는 아래 두 가지 조건을 <b>모두</b> 충족해야 합니다.",
    action: (is90, is450) => {
      if (is90 && is450) {
        return "prolia_q1_giop_type";
      } else {
        return "prolia_res_E_steroid_cond";
      }
    }
  },
  prolia_q1_giop_type: {
    text: "환자의 성별 및 연령/폐경 상태를 선택해주세요.",
    info: "※ 해당 정보에 따라 T-score 또는 Z-score 평가 기준이 다르게 적용됩니다.",
    options: [
      { label: "폐경 후 여성 / 만 50세 이상 남성 (T-score 기준)", action: () => { answers.giopAge = 'adult'; return "prolia_q2_date"; } },
      { label: "폐경 전 여성 / 만 50세 미만 남성 (Z-score 기준)", action: () => { answers.giopAge = 'young'; return "prolia_q2_date"; } }
    ]
  },
  prolia_q2_date: {
    type: "date",
    text: "가장 최근에 실시한 중심골(요추 또는 대퇴) 골밀도 검사 날짜를 입력해 주세요.",
    action: (val) => {
      answers.proliaQ1Date = val; // 골밀도 검사 날짜 (안내용)

      const bmdDate = new Date(val);
      const today = new Date();
      const diffDays = (today - bmdDate) / (1000 * 60 * 60 * 24);

      if (diffDays > 365.25) {
        return "prolia_res_E_date_expired";
      }

      if (answers.proliaType === 'giop' && answers.giopAge === 'young') {
        return "prolia_q3_score_z";
      }
      return "prolia_q3_score_t";
    }
  },
  prolia_q3_score_t: {
    type: "number",
    text: "해당 검사의 결과값(T-score)을 정확히 입력해 주세요.",
    info: "※ 주의: '이하/이상'은 해당 수치를 포함하며, '초과/미만'은 해당 수치를 포함하지 않습니다.<br>※ 요추 측정 시 골절, 주변 요추와 T-score 차이 ≥ 1.0*, 보형물 등 구조적변화에 해당하는 부위를 제외한 평균값을 입력하세요.",
    action: (val) => { answers.proliaQ2 = parseFloat(val); return "prolia_q4_has_history"; }
  },
  prolia_q3_score_z: {
    type: "number",
    text: "해당 검사의 결과값(Z-score)을 정확히 입력해 주세요.",
    info: "※ 주의: '이하/이상'은 해당 수치를 포함하며, '초과/미만'은 해당 수치를 포함하지 않습니다.",
    action: (val) => { answers.proliaQ2 = parseFloat(val); return "prolia_q4_has_history"; }
  },
  prolia_q4_has_history: {
    text: "환자가 이전에 '프롤리아 주사'를 맞은 적이 있습니까?",
    options: [
      { label: "예 (과거 투여 이력 있음)", action: () => "prolia_q4_date" },
      {
        label: "아니오 (이번이 최초 투여임)", action: () => {
          answers.proliaQ3 = null;
          return branchByProliaType();
        }
      }
    ]
  },
  prolia_q4_date: {
    type: "date",
    text: "환자가 가장 마지막으로 '프롤리아 주사'를 맞은 날짜를 입력해 주세요.",
    action: (val) => {
      answers.proliaQ3 = val;
      return branchByProliaType();
    }
  },

  // [일반 골다공증] 분기
  prolia_frac_1: {
    text: "X-ray 등에서 '골다공증성 골절'이 확인되었나요?",
    info: "※ 인정 가능 부위: 대퇴골, 척추, 요골, 상완골, 골반골, 천골, 발목",
    options: [
      { label: "예", action: () => "prolia_frac_2" },
      { label: "아니오", action: () => autoEvalNormalScores() }
    ]
  },
  prolia_frac_2: {
    text: "골절 사실이 '진료기록지'와 '영상 판독지' 양쪽 모두에 기록되어 있나요?",
    options: [
      { label: "예", action: () => "prolia_res_A" },
      { label: "아니오", action: () => autoEvalNormalScores() }
    ]
  },

  // (추적 호전 환자용 분기)
  prolia_q8_1: {
    text: "입력하신 수치가 호전 구간(-2.5 초과 ~ -2.0 이하)입니다. 이 환자가 과거에 '건강보험 급여'로 프롤리아를 맞은 적이 있나요?",
    info: "",
    options: [
      { label: "예", action: () => "prolia_q8_2" },
      { label: "아니오", action: () => "prolia_res_E_new_patient" }
    ]
  },
  prolia_q8_2: {
    text: "첫 급여 투여 당시, 골밀도 수치가 -2.5 이하였나요?",
    info: "※ 주의: '이하/이상'은 해당 수치를 포함하며, '초과/미만'은 해당 수치를 포함하지 않습니다.<br>※ 시작점이 급여 기준을 충족했어야 호전 기준도 연속 적용됩니다.",
    options: [
      { label: "예", action: () => "prolia_q11" },
      { label: "아니오", action: () => "prolia_res_E_start_invalid" }
    ]
  },
  prolia_q11: {
    text: "과거에 위 호전 구간(-2.5 초과 ~ -2.0 이하)에서 프롤리아를 총 몇 번 투여받았나요?",
    info: "⚠️ 주의: T-score -2.5 이하일 때 투여받은 횟수는 제외하고, 수치가 <b>호전(-2.4 ~ -2.0)된 이후 통과한 횟수</b>만 선택하세요.",
    options: [
      { label: "0회 (호전 후 이번이 첫 투여)", action: () => { answers.proliaCount = 0; return "prolia_res_D"; } },
      { label: "1회 (호전 후 6개월간 1회 투여함)", action: () => { answers.proliaCount = 1; return "prolia_res_D"; } },
      { label: "2회 (호전 후 1년간 2회 투여함)", action: () => { answers.proliaCount = 2; return "prolia_res_D"; } },
      { label: "3회 (호전 후 1년 6개월간 3회 투여함)", action: () => { answers.proliaCount = 3; return "prolia_res_D"; } },
      { label: "4회(호전 후 2년/4회 투여 완료함)", action: () => { answers.proliaCount = 4; return "prolia_res_E_limit"; } }
    ]
  },

  // --- 프롤리아 최종 결과 노드 ---
  prolia_res_A: {
    isResult: true,
    dynamicRender: () => renderProliaResult("급여 대상입니다!", "success", "6개월 간격으로 총 6회 (3년)", "반드시 진료기록지와 영상 판독지 양쪽 모두에 골절 사실이 기재되어 있어야 합니다.")
  },
  prolia_res_B: {
    isResult: true,
    dynamicRender: () => renderProliaResult("급여 대상입니다!", "success", "6개월 간격으로 2회 (1년) (글루코코르티코이드 연관)", "추후 추적검사에서도 허가 기준을 유지할 경우 계속 급여가 가능합니다.")
  },
  prolia_res_C: {
    isResult: true,
    dynamicRender: () => renderProliaResult("급여 대상입니다!", "success", "6개월 간격으로 2회 (1년 단위로 연장)", "추후 추적검사 시에도 동일 기준(-2.5 이하 등)을 유지할 경우 계속 급여가 인정됩니다.")
  },
  prolia_res_D: {
    isResult: true,
    dynamicRender: () => renderProliaResult("급여 대상입니다! (호전 적용)", "success", "1년(2회) 추가 투여 인정", "※ 2년 뒤(총 투여기간 3년 뒤)에도 계속 이 수치라면, 다른 약(비스포스포네이트 등)으로 교체 투여를 고려해야 합니다.", renderProliaHojeon())
  },
  prolia_res_E: {
    isResult: true,
    dynamicRender: () => renderProliaResult("급여 기준 미달 (전액본인부담)", "danger", "", "위의 고시된 건강보험 급여 인정 기준을 충족하지 않으므로, 전액 본인 부담으로 투여해야 합니다.")
  },
  prolia_res_E_new_patient: {
    isResult: true,
    dynamicRender: () => renderProliaResult("급여 기준 미달 (전액본인부담)", "danger", "", "신규 환자는 처음부터 수치가 -2.5 이하인 경우만 급여 처방이 가능하므로, 전액 본인 부담으로 투여해야 합니다.")
  },
  prolia_res_E_start_invalid: {
    isResult: true,
    dynamicRender: () => renderProliaResult("급여 기준 미달 (전액본인부담)", "danger", "", "과거 최초 투여 시작 수치가 급여 기준을 충족해야 호전 기준도 연속해서 적용 가능합니다. 전액 본인 부담으로 투여해야 합니다.")
  },
  prolia_res_E_steroid_cond: {
    isResult: true,
    dynamicRender: () => renderProliaResult("급여 기준 미달 (전액본인부담)", "danger", "", "글루코코르티코이드 유발 골다공증 투여 조건(최근 6개월간 90일 초과 투여, 450mg 이상)을 모두 충족하지 않으므로 전액 본인 부담으로 투여해야 합니다.")
  },
  prolia_res_E_limit: {
    isResult: true,
    dynamicRender: () => renderProliaResult("급여 기준 한도 초과 (전액본인부담)", "danger", "", "호전 환자의 추가 급여 투여가능 횟수 총 4회(2년)를 모두 소진하였습니다. 다른 약제(비스포스포네이트 등)로의 교체 투여를 고려해 보시기 바랍니다.")
  },
  prolia_res_E_date_expired: {
    isResult: true,
    dynamicRender: () => renderProliaResult("급여 기간 만료 (전액본인부담)", "danger", "", "골밀도 검사 결과가 너무 오래되었습니다(1년 초과). 프롤리아 급여 연장을 위해서는 1년 이내의 추적 검사 결과가 필요하므로, 검사를 재실시하거나 전액 본인 부담으로 투여해야 합니다.")
  },


  // ============================================
  // 골밀도검사(BMD) 라우팅
  // ============================================

  // --- 1. 성별 ---
  start: {
    text: "환자의 성별을 선택해주세요.",
    options: [
      { label: "여성", action: () => { answers.gender = 'F'; return "age_f"; } },
      { label: "남성", action: () => { answers.gender = 'M'; return "age_m"; } }
    ]
  },

  // --- 2. 연령대 ---
  age_f: {
    text: "환자의 연령대를 선택해주세요.",
    options: [
      { label: "65세 이상", action: () => { answers.ageGroup = 'senior'; return "purpose"; } },
      { label: "18세 이상 ~ 64세 이하", action: () => { answers.ageGroup = 'adult'; return "purpose"; } },
      { label: "10세 이상 ~ 17세 이하", action: () => { answers.ageGroup = 'teen'; return "purpose"; } },
      { label: "10세 미만", action: () => "result_not_eligible_age" }
    ]
  },
  age_m: {
    text: "환자의 연령대를 선택해주세요.",
    options: [
      { label: "70세 이상", action: () => { answers.ageGroup = 'senior'; return "purpose"; } },
      { label: "18세 이상 ~ 69세 이하", action: () => { answers.ageGroup = 'adult'; return "purpose"; } },
      { label: "10세 이상 ~ 17세 이하", action: () => { answers.ageGroup = 'teen'; return "purpose"; } },
      { label: "10세 미만", action: () => "result_not_eligible_age" }
    ]
  },

  // --- 3. 목적 (검사 이력) ---
  purpose: {
    text: "이전에 골밀도 검사를 받은 적이 있나요?",
    options: [
      { label: "아니오 (이번이 첫 검사입니다)", action: () => routeDiagnosis() },
      { label: "예 (과거에 받은 적이 있습니다)", action: () => "fu_date" }
    ]
  },

  // --- 진단 (Diagnosis) 흐름 ---
  f_preg_diag: {
    text: "임신과 연관된 골다공증성 골절(Pregnancy & lactation Associated Osteoporosis)이 의심됩니까?",
    options: [
      { label: "예", action: () => "result_diag_eligible" },
      { label: "아니오", action: () => "f_meno" }
    ]
  },
  f_meno: {
    text: "환자는 폐경 이후입니까?",
    options: [
      { label: "예 (폐경 이후)", action: () => "f_bmi" },
      { label: "아니오 (폐경 이전)", action: () => "f_amen" }
    ]
  },
  f_bmi: {
    text: "체질량지수(BMI)가 18.5 미만인 저체중 상태입니까?",
    info: "※ BMI 계산법: 체중(kg) ÷ (신장(m) × 신장(m))<br>(예: 키 160cm, 몸무게 45kg인 경우 45 / (1.6 * 1.6) = 약 17.58)",
    options: [
      { label: "예", action: () => "result_diag_eligible" },
      { label: "아니오", action: () => "f_frac" }
    ]
  },
  f_frac: {
    text: "이전에 비외상성 골절을 겪으신 적이 있습니까?",
    info: "※ 비외상성 골절<br>- 정의: 일상적인 활동이나 낮은 에너지(자기 키 이하 높이에서의 낙상 포함)로 발생한 골절<br>- 예시: 제자리에서 주저앉음, 앉았다 일어나다가, 물건 들다가, 심한 경우 기침만으로도 발생",
    options: [
      { label: "예", action: () => "result_diag_eligible" },
      { label: "아니오", action: () => "f_fam" }
    ]
  },
  f_fam: {
    text: "부모, 형제 등 가족 중에 비외상성 골절 병력을 가진 분이 있습니까?",
    info: "※ 비외상성 골절<br>- 정의: 일상적인 활동이나 낮은 에너지(자기 키 이하 높이에서의 낙상 포함)로 발생한 골절<br>- 예시: 제자리에서 주저앉음, 앉았다 일어나다가, 물건 들다가, 심한 경우 기침만으로도 발생",
    options: [
      { label: "예", action: () => "result_diag_eligible" },
      { label: "아니오", action: () => "f_surg" }
    ]
  },
  f_surg: {
    text: "양측 난소 절제술 등 외과적 수술로 인해 폐경이 발생했습니까?",
    options: [
      { label: "예", action: () => "result_diag_eligible" },
      { label: "아니오", action: () => "f_early" }
    ]
  },
  f_early: {
    text: "40세 이전에 자연 폐경이 발생했습니까?",
    options: [
      { label: "예", action: () => "result_diag_eligible" },
      { label: "아니오", action: () => "common_disease" }
    ]
  },
  f_amen: {
    text: "최근 1년 이상 비정상적으로 생리가 없는 상태(무월경)입니까?",
    options: [
      { label: "예", action: () => "result_diag_eligible" },
      { label: "아니오", action: () => "f_frac_pre" }
    ]
  },
  f_frac_pre: {
    text: "이전에 비외상성 골절을 겪으신 적이 있습니까?",
    info: "※ 비외상성 골절<br>- 정의: 일상적인 활동이나 낮은 에너지(자기 키 이하 높이에서의 낙상 포함)로 발생한 골절<br>- 예시: 제자리에서 주저앉음, 앉았다 일어나다가, 물건 들다가, 심한 경우 기침만으로도 발생",
    options: [
      { label: "예", action: () => "result_diag_eligible" },
      { label: "아니오", action: () => "common_disease" }
    ]
  },
  m_frac: {
    text: "이전에 비외상성 골절을 겪으신 적이 있습니까?",
    info: "※ 비외상성 골절<br>- 정의: 일상적인 활동이나 낮은 에너지(자기 키 이하 높이에서의 낙상 포함)로 발생한 골절<br>- 예시: 제자리에서 주저앉음, 앉았다 일어나다가, 물건 들다가, 심한 경우 기침만으로도 발생",
    options: [
      { label: "예", action: () => "result_diag_eligible" },
      { label: "아니오", action: () => "common_disease" }
    ]
  },
  common_disease: {
    text: "골다공증을 유발할 수 있는 질환을 앓고 있습니까?",
    info: "※ 예시: 갑상선 기능 항진증, 쿠싱 증후군, 성선 기능 저하증, 당뇨, 크론병, 궤양성 대장염, 위 절제술, 만성 간질환, 류마티스 관절염, 강직성 척추염, 만성 신부전 등",
    options: [
      { label: "예", action: () => "result_diag_eligible" },
      { label: "아니오", action: () => "common_drug" }
    ]
  },
  common_drug: {
    text: "골다공증을 유발할 수 있는 약물(글루코코르티코이드 등)을 3개월 이상 복용 중이거나 투여할 계획입니까?",
    options: [
      { label: "예", action: () => "result_diag_eligible" },
      { label: "아니오", action: () => "common_must" }
    ]
  },
  common_must: {
    text: "그 외에 의학적으로 골다공증 검사가 반드시 필요한 특별한 상태입니까?",
    info: "※ 이 경우 청구 시 구체적인 의학적 사유 소명이 필요합니다.",
    options: [
      { label: "예", action: () => "result_diag_eligible" },
      { label: "아니오", action: () => "result_not_eligible" }
    ]
  },

  // 10세 ~ 17세 진단
  teen_disease: {
    text: "골다공증을 유발할 수 있는 질환을 앓고 있습니까?",
    info: "※ 예시: 갑상선 기능 항진증, 쿠싱 증후군, 성선 기능 저하증, 당뇨, 크론병, 궤양성 대장염, 위 절제술, 만성 간질환, 류마티스 관절염, 강직성 척추염, 만성 신부전 등",
    options: [
      { label: "예", action: () => "result_diag_teen" },
      { label: "아니오", action: () => "teen_drug" }
    ]
  },
  teen_drug: {
    text: "골다공증을 유발할 수 있는 약물(글루코코르티코이드 등)을 3개월 이상 복용 중이거나 투여 계획이 있습니까?",
    options: [
      { label: "예", action: () => "result_diag_teen" },
      { label: "아니오", action: () => "teen_must" }
    ]
  },
  teen_must: {
    text: "그 외에 골다공증 검사가 반드시 필요한 특별한 임상적 소견이 있습니까?",
    options: [
      { label: "예", action: () => "result_diag_teen" },
      { label: "아니오", action: () => "result_not_eligible" }
    ]
  },

  // --- 추적 검사 (Follow-up) 흐름 ---
  fu_date: {
    type: "date",
    text: "이전에 골밀도 검사를 받은 날짜를 선택해주세요.",
    action: (dateVal) => {
      answers.lastDate = dateVal;
      return checkFollowUpRouting();
    }
  },

  f_fu_preg: {
    text: "현재 환자가 임신과 연관된 골다공증성 골절로 진단되어 추적 검사하는 중입니까?",
    options: [
      { label: "예", action: () => "f_fu_preg_count" },
      { label: "아니오", action: () => "fu_tscore" }
    ]
  },
  f_fu_preg_count: {
    text: "이전에 해당 소견(임신/수유 관련 골다공증)으로 급여 검사를 받은 적이 있습니까?",
    info: "※ 해당 특례는 관련 소견으로 진단된 후 6개월 간격으로 <b>최대 2회까지만</b> 인정됩니다.",
    options: [
      { label: "아니오 (이번이 첫 추적 검사입니다)", action: () => { answers.intervalCode = 'preg'; return "result_fu_calc"; } },
      { label: "예 (이미 1회 이상 추적검사를 받았습니다)", action: () => "result_not_eligible" }
    ]
  },

  fu_tscore: {
    text: "이전 골밀도검사(BMD)의 결과(T-score) 범위를 선택해주세요.",
    options: [
      { label: "정상 (-1.0 이상)", action: () => { answers.tscore = 'normal'; return "fu_steroid"; } },
      { label: "골감소증 (-1.0 미만 ~ -2.5 초과)", action: () => { answers.intervalCode = 'other'; return "result_fu_calc"; } },
      { label: "골다공증 (-2.5 이하)", action: () => { answers.tscore = 'severe'; return "fu_steroid"; } }
    ]
  },
  fu_steroid: {
    text: "현재 글루코코르티코이드(스테로이드) 등을 3개월 이상 복용 중입니까?",
    options: [
      { label: "예", action: () => { answers.exception = true; return "fu_limit_chk"; } },
      { label: "아니오", action: () => "fu_pth" }
    ]
  },
  fu_pth: {
    text: "현재 부갑상선기능항진증으로 약물치료를 받고 있습니까?",
    options: [
      { label: "예", action: () => { answers.exception = true; return "fu_limit_chk"; } },
      { label: "아니오", action: () => { answers.exception = false; return "result_fu_calc"; } }
    ]
  },
  fu_limit_chk: {
    text: "환자가 이미 '최초 진단 후 첫 1년 이내'에 실시하는 2회의 급여 검사를 모두 받았습니까?",
    info: "※ 스테로이드/부갑상선 환자 특례: 최초 진단 시 1회, 이후 첫 1년 이내에 2회(총 3회)까지 짧은 주기가 인정되며, 그 이후부터는 1년 주기가 적용됩니다.",
    options: [
      { label: "예 (이미 첫 1년 내 2회 검사를 완료함)", action: () => { answers.isFirstYearFinished = true; return "result_fu_calc"; } },
      { label: "아니오 (아직 첫 1년 내 2회 검사 전임)", action: () => { answers.isFirstYearFinished = false; return "result_fu_calc"; } }
    ]
  },

  teen_zscore: {
    text: "이전 골밀도 검사의 Z-score 범위를 선택해주세요.",
    options: [
      { label: "정상 (-1.0 초과)", action: () => { answers.intervalCode = 'teen_high'; return "result_fu_calc"; } },
      { label: "경계치 (-1.0 이하 ~ -2.0 초과)", action: () => { answers.intervalCode = 'teen_mid'; return "result_fu_calc"; } },
      { label: "비정상 (-2.0 이하)", action: () => "teen_limit_chk" }
    ]
  },
  teen_limit_chk: {
    text: "환자가 이미 '최초 진단 후 첫 1년 이내'에 실시하는 2회의 급여 검사를 모두 받았습니까?",
    info: "※ 소아/청소년 비정상(Z-score -2.0 이하) 특례: 최초 진단 시 1회, 이후 첫 1년 이내에 6개월 간격으로 2회까지 인정되며, 그 이후부터는 1년 주기가 적용됩니다.",
    options: [
      { label: "예 (이미 첫 1년 내 2회 검사를 완료함)", action: () => { answers.intervalCode = 'teen_low'; answers.isFirstYearFinished = true; return "result_fu_calc"; } },
      { label: "아니오 (아직 첫 1년 내 2회 검사 전임)", action: () => { answers.intervalCode = 'teen_low'; answers.isFirstYearFinished = false; return "result_fu_calc"; } }
    ]
  },

  // --- 결과 노드 ---
  result_not_eligible_age: {
    isResult: true,
    dynamicRender: () => renderSimpleResult("급여가 불가능합니다.", "danger", "10세 미만은 급여기준에 명시되어 있지 않아 급여가 불가합니다.")
  },
  result_not_eligible: {
    isResult: true,
    dynamicRender: () => renderSimpleResult("급여가 불가능합니다.", "danger", "해당 조건에 부합하는 급여 기준이 없습니다.")
  },
  result_diag_eligible: {
    isResult: true,
    dynamicRender: () => renderSimpleResult("급여가 가능합니다!", "success", "조건을 충족하여 초기 진단 목적으로 1회 급여가 인정됩니다.")
  },
  result_diag_teen: {
    isResult: true,
    dynamicRender: () => {
      const extraHtml = `
        <div style='margin-top:1.2rem; padding:1rem; background-color:#fffbeb; color:#d97706; border:2px solid #fde68a; border-radius:0.75rem; font-weight:700; font-size:1.2rem; text-align:center;'>
          ※ 보건복지부 선별급여 대상: 본인부담율 80%
        </div>
        <div style='margin-top:0.4rem; font-size:0.95rem; color:#64748b; text-align:center;'>
          청구 명세서 ‘특정내역(JT024)’란에 검사 결과를 작성하여 청구 요망
        </div>
      `;
      return renderSimpleResult("선별급여 가능합니다!", "warning", "소아청소년 진단 기준을 충족하였습니다.", extraHtml);
    }
  },
  result_fu_calc: {
    isResult: true,
    dynamicRender: (ans) => calcFollowUpResult(ans)
  }
};

// 공통: 의무기록 기재 확인 체크박스 생성 함수
function getUniversalCheckboxHtml() {
  return `
    <label style="display:flex; align-items:flex-start; gap:0.5rem; cursor:pointer; margin-top:0.75rem; padding-top:0.75rem; border-top:1px dashed #cbd5e1; user-select:none;">
      <input type="checkbox" style="margin-top:0.25rem; transform:scale(1.2);">
      <span style="font-size: 0.95rem; font-weight: normal; color: #475569; line-height:1.4;">
        4주 범위 내에서 앞당겨 검사/투여를 진행하는 경우, 해당 불가피한 사유를 진료기록지에 명시하였나요?
      </span>
    </label>
  `;
}

// ===================================
// 프롤리아 로직 자동계산 헬퍼
// ===================================

function branchByProliaType() {
  if (answers.proliaType === 'general') {
    return "prolia_frac_1";
  } else {
    return autoEvalSteroidScore();
  }
}

function autoEvalNormalScores() {
  const score = answers.proliaQ2;
  // T-score <= -2.5
  if (score <= -2.5) {
    return "prolia_res_C";
  }
  // -2.5초과 ~ -2.0이하
  if (score > -2.5 && score <= -2.0) {
    return "prolia_q8_1";
  }
  // 그 외 (-2.0 초과)
  return "prolia_res_E";
}

function autoEvalSteroidScore() {
  const score = answers.proliaQ2;
  if (answers.giopAge === 'adult') {
    if (score <= -1.5) return "prolia_res_B";
    return "prolia_res_E";
  } else {
    if (score <= -2.0) return "prolia_res_B";
    return "prolia_res_E";
  }
}
// 라우팅 헬퍼
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

// 공통 날짜 포맷 함수
const formatD = (d) => `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`;
const getTodayStr = () => formatD(new Date());

function renderProliaHojeon() {
  const count = answers.proliaCount || 0;
  const currentIter = count + 1;
  const remaining = 3 - count;

  let squares = '';
  for (let i = 1; i <= 4; i++) {
    const isPast = i < currentIter;
    const isCurr = i === currentIter;
    let bgColor = '#f1f5f9';
    let textColor = '#64748b';
    let border = 'none';
    let label = '대기중';

    if (isPast) { bgColor = '#bfdbfe'; textColor = '#1e3a8a'; label = '참여완료'; }
    if (isCurr) { bgColor = '#3b82f6'; textColor = '#ffffff'; label = '이번차수'; border = '2px solid #1e40af'; }

    squares += `
      <div style="flex:1; background:${bgColor}; border:${border}; border-radius:0.5rem; inset:0; padding:0.5rem 0; text-align:center; color:${textColor}; font-size:0.95rem; font-weight:700;">
        ${i}회차<br><span style="font-size:0.8rem; font-weight:normal;">${label}</span>
      </div>
    `;
  }

  return `
    <div style="margin-top:1.5rem; padding:1.25rem; background-color:#eff6ff; border-radius:0.75rem; border:1px solid #bfdbfe;">
      <div style="font-weight:800; color:#1e40af; font-size:1.15rem; margin-bottom:0.75rem;">✅ 판정: 이번 차수 '급여' 가능 (예외 인정)</div>
      <ul style="list-style:none; padding-left:0; margin-bottom:1rem; font-size:0.95rem; color:#334155; line-height:1.6;">
        <li>• <b>누적 현황:</b> 총 4회(2년) 중 이번이 <b>${currentIter}회차</b> 투여 예정입니다.</li>
        <li>• <b>남은 횟수:</b> 이번 투여 이후로 <b>${remaining}회</b> 더 급여 가능합니다.</li>
      </ul>
      <div style="display:flex; gap:0.5rem;">
        ${squares}
      </div>
    </div>
  `;
}

//일반 주사 결과 렌더링
function renderProliaResult(title, type, terms, notice, customHtml = "") {
  const isEligible = type === 'success';
  let finalDecision = "";
  let displayTitle = title;
  let nextDateStr = "-";

  if (answers.proliaQ3 && isEligible) {
    const lastDate = new Date(answers.proliaQ3);
    const nextDate = new Date(lastDate);
    nextDate.setMonth(nextDate.getMonth() + 6);

    const today = new Date();
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const n = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate()).getTime();

    nextDateStr = formatD(nextDate);

    if (t >= n) {
      displayTitle = "급여 처방 가능합니다!";
      finalDecision = `오늘(${getTodayStr()}) 급여로 주사를 처방받으실 수 있습니다.`;
    } else {
      const earlyDate = new Date(nextDate);
      earlyDate.setDate(earlyDate.getDate() - 28);
      const e = new Date(earlyDate.getFullYear(), earlyDate.getMonth(), earlyDate.getDate()).getTime();

      if (t >= e) {
        displayTitle = "급여 처방 가능합니다! (조기 투여)";
        finalDecision = `오늘(${getTodayStr()}) 급여로 주사를 처방받으실 수 있습니다.<br><span style="font-size:0.95rem; font-weight:normal; line-height: 1.5; display: inline-block; margin-top: 0.5rem;">당해 연도 기준 4주(28일) 범위 내에서 조기 투여 불가피 사유가 인정되는 구간입니다.</span>`;
      } else {
        displayTitle = "급여 기준 충족 (간격 대기)";
        finalDecision = `투여 간격 6개월이 아직 지나지 않아 오늘(${getTodayStr()})은 급여로 주사를 처방받으실 수 없습니다.`;
      }
    }
  } else if (!answers.proliaQ3 && isEligible) {
    displayTitle = "급여 처방 가능합니다!";
    finalDecision = `최초 투여로 오늘(${getTodayStr()})부터 급여로 주사를 처방받으실 수 있습니다.`;
    nextDateStr = getTodayStr(); // Force replacing "오늘 기준 최초 처방 진행" with actual date
  } else {
    displayTitle = title;
    finalDecision = `전액 본인 부담으로 투여해야 합니다.`;
  }

  currentResultStatus = isEligible ? "급여 기준 충족 확인 완료" : "급여 기준 미달";

  const extraHtml = isEligible ? `
    <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 0.5rem;"><strong>급여 인정 기간:</strong> <span style="float:right;">${terms}</span></div>
    <div><strong>다음 차수 투여 예정일:</strong> <span style="float:right; color: var(--primary); font-weight: bold;">${nextDateStr}</span></div>
    ${customHtml}
  ` : '';

  return `
    <div style="opacity:0; animation: fadeIn 0.4s ease forwards;">
      <div class="result-title" style="font-size: 2rem; margin-bottom: 0.5rem; color: var(--${type}); font-weight: 800;">${displayTitle}</div>
      <div class="date-box" style="font-size: 1.15rem; line-height: 1.8;">
        ${extraHtml}
        ${notice ? `<div style="font-size: 0.95rem; font-weight: normal; color: #64748b; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed #cbd5e1;">※ 안내: ${notice}</div>` : ''}
      </div>
      <div style="margin-top: 1.5rem; font-size: 1.25rem; font-weight: bold; background-color: var(--${type}-bg); color: var(--${type}-text); padding: 1.2rem; border-radius: 0.75rem; text-align: center; word-break: keep-all;">
        ${finalDecision}
      </div>
      ${getResultActionHtml()}
    </div>
  `;
}


// 일반 진단(단순 결과) 렌더링 함수
function renderSimpleResult(title, type, reason, extraHtml = "") {
  const isEligible = type === 'success' || type === 'warning';
  const finalDecision = isEligible
    ? `오늘(${getTodayStr()}) 검사를 받으실 수 있습니다.`
    : `오늘(${getTodayStr()})은 검사를 받으실 수 없습니다.`;

  const guidanceHtml = type === 'danger'
    ? `<div style="font-size: 0.95rem; font-weight: normal; color: #64748b; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed #cbd5e1;">※ 안내: 단순 건강검진 목적의 검사를 원하시는 경우 비급여 대상입니다.</div>`
    : '';

  currentResultStatus = isEligible ? "급여 기준 충족 확인 완료" : "급여 불가";

  return `
    <div style="opacity:0; animation: fadeIn 0.4s ease forwards;">
      <div class="result-title" style="font-size: 1.8rem; margin-bottom: 0.5rem; color: var(--${type}); font-weight: 800;">${title}</div>
      <div class="date-box" style="font-size: 1.15rem; line-height: 1.8;">
        <div><strong>판정 사유:</strong> ${reason}</div>
        ${extraHtml}
        ${guidanceHtml}
      </div>
      <div style="margin-top: 1.5rem; font-size: 1.25rem; font-weight: bold; background-color: var(--${type}-bg); color: var(--${type}-text); padding: 1.2rem; border-radius: 0.75rem; text-align: center;">
        ${finalDecision}
      </div>
      ${getResultActionHtml()}
    </div>
  `;
}

// 추적 검사 날짜 계산 헬퍼
function calcFollowUpResult(ans) {
  const lastDate = new Date(ans.lastDate);
  const today = new Date();

  const isWithinFirstYear = (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24) <= 365.25;

  let intervalMonths = 12; // default
  let intervalText = "1년";

  if (ans.intervalCode === 'preg') { intervalMonths = 6; intervalText = "6개월"; }
  else if (ans.intervalCode === 'other') { intervalMonths = 12; intervalText = "1년"; }
  else if (ans.intervalCode === 'teen_mid') { intervalMonths = 12; intervalText = "1년"; }
  else if (ans.intervalCode === 'teen_low') {
    if (!ans.isFirstYearFinished) { intervalMonths = 6; intervalText = "6개월"; }
    else { intervalMonths = 12; intervalText = "1년"; }
  }
  else if (ans.tscore) {
    if (ans.tscore === 'normal') {
      if (ans.exception && !ans.isFirstYearFinished) { intervalMonths = 12; intervalText = "1년"; }
      else { intervalMonths = 24; intervalText = "2년"; }
    } else if (ans.tscore === 'severe') {
      if (ans.exception && !ans.isFirstYearFinished) { intervalMonths = 6; intervalText = "6개월"; }
      else { intervalMonths = 12; intervalText = "1년"; }
    }
  }

  const baseDate = new Date(lastDate);
  baseDate.setMonth(baseDate.getMonth() + intervalMonths);

  const earlyDate = new Date(baseDate);
  earlyDate.setDate(earlyDate.getDate() - 28);

  const todayStr = getTodayStr();
  const lastDateStr = formatD(lastDate);
  const baseDateStr = formatD(baseDate);
  const earlyDateStr = formatD(earlyDate);

  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const b = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate()).getTime();
  const e = new Date(earlyDate.getFullYear(), earlyDate.getMonth(), earlyDate.getDate()).getTime();

  let statusTitle = "";
  let finalDecision = "";
  let badgeColor = "";

  const isTeen = ans.ageGroup === 'teen';
  const prefix = isTeen ? "선별급여 가능합니다!" : "급여가 가능합니다!";

  if (t >= b) {
    statusTitle = prefix;
    badgeColor = isTeen ? "warning" : "success"; // Teen is always warning level
    finalDecision = `오늘(${todayStr}) 검사를 받으실 수 있습니다.`;
  } else if (t >= e) {
    statusTitle = prefix;
    badgeColor = "warning";
    finalDecision = `오늘(${todayStr}) 검사를 받으실 수 있습니다.`;
  } else {
    statusTitle = `급여가 불가능합니다.`;
    badgeColor = "danger";
    finalDecision = `오늘(${todayStr})은 급여로 검사를 받으실 수 없습니다.`;
  }

  currentResultStatus = (t >= b || t >= e) ? "급여 가능 수준(추적)" : "급여 불가(추적)";

  let earlyNoticeHtml = "";
  if (!isTeen && t < b && t >= e) {
    earlyNoticeHtml = `
      <div style="margin-top: 0.75rem; padding: 0.75rem; background-color: #fffbeb; color: #92400e; border: 1px solid #fde68a; border-radius: 0.5rem; font-size: 0.95rem; line-height: 1.5;">
        <div style="margin-bottom: 0.5rem;"><strong>💡 조기 검사 안내:</strong><br>
        본 검사는 정규 검사 가능일 이전 4주 이내인 '조기 검사 인정 범위'에 해당하여 급여가 가능합니다.</div>
        ${getUniversalCheckboxHtml()}
      </div>
    `;
  }

  const teenWarning = isTeen ? `
    <div style='margin-top:1.2rem; padding:1rem; background-color:#fffbeb; color:#d97706; border:2px solid #fde68a; border-radius:0.75rem; font-weight:700; font-size:1.2rem; text-align:center;'>
      ※ 보건복지부 선별급여 대상: 본인부담율 80%
    </div>
    <div style='margin-top:0.4rem; font-size:0.95rem; color:#64748b; text-align:center;'>
      청구 명세서 ‘특정내역(JT024)’란에 검사 결과를 작성하여 청구 요망
    </div>
  ` : '';

  return `
    <div style="opacity:0; animation: fadeIn 0.4s ease forwards;">
      <div class="result-title" style="font-size: 2rem; margin-bottom: 0.5rem; color: var(--${badgeColor}); font-weight: 800;">${statusTitle}</div>
      <div class="date-box" style="font-size: 1.15rem; line-height: 2;">
        <div><strong>마지막 검사일:</strong> <span style="float: right;">${lastDateStr}</span></div>
        <div><strong>급여 인정 주기:</strong> <span style="float: right;">${intervalText}</span></div>
        <div style="color: var(--primary); font-weight: bold; border-top: 1px solid #e2e8f0; padding-top: 0.5rem; margin-top: 0.5rem;">
          <strong>정규 검사 가능일:</strong> <span style="float: right;">${baseDateStr}</span>
        </div>
        <div style="font-size: 0.9rem; color: #64748b; margin-top: 0.75rem; line-height: 1.5; font-weight: normal;">
          ※ 환자의 장기부재, 진료일정 등 불가피한 사유로 추적검사 실시간격을 충족하지 못하는 경우 4주 범위 내에서 조기검사가 인정됩니다.
        </div>
        ${earlyNoticeHtml}
      </div>
      <div style="margin-top: 1.5rem; font-size: 1.25rem; font-weight: bold; background-color: var(--${badgeColor}-bg); color: var(--${badgeColor}-text); padding: 1.25rem; border-radius: 0.75rem; text-align: center;">
        ${finalDecision}
      </div>
      ${getResultActionHtml()}
      ${badgeColor === 'danger' ? `<div style="font-size: 0.95rem; font-weight: normal; color: #64748b; margin-top: 0.75rem; padding: 0.75rem; border: 1px dashed #cbd5e1; border-radius: 0.5rem; background: #f8fafc;">※ 안내: 단순 건강검진 목적의 검사를 원하시는 경우 비급여 대상입니다.</div>` : ''}
      ${teenWarning}
    </div>
  `;
}

// ----------------------------------------
// UI Rendering Logic
// ----------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  renderStep(currentStep);
});

function renderStep(stepId) {
  const node = logicTree[stepId];
  if (!node) return;

  if (stepId === 'root') {
    document.getElementById('main-title').innerText = "FILTER";
    document.getElementById('main-desc').innerText = "30초 필터링으로 내 케이스를 확인하고, 우리 병원의 정당한 수익을 지키세요.";
  } else if (appMode === 'bone') {
    document.getElementById('main-title').innerText = "골밀도검사(BMD) 급여 판별기";
    document.getElementById('main-desc').innerText = "순서대로 질문에 답하시면 급여 적용 여부를 확인시켜 드립니다.";
  } else if (appMode === 'prolia') {
    document.getElementById('main-title').innerText = "프롤리아 프리필드시린지 급여 판별기";
    document.getElementById('main-desc').innerText = "안내에 따라 요양급여 대상 여부와 다음 투여일을 확인하세요.";
  }

  const card = document.getElementById('question-card');
  const questionText = document.getElementById('question-text');
  const additionalInfo = document.getElementById('additional-info');
  const optionsContainer = document.getElementById('options-container');
  const btnBack = document.getElementById('btn-back');
  const btnReset = document.getElementById('btn-reset');
  const stepCounter = document.getElementById('step-counter');

  optionsContainer.classList.toggle('root-options', stepId === 'root');
  btnReset.classList.remove('hidden');

  card.classList.remove('fade-in');
  card.classList.add('fade-out');

  setTimeout(() => {
    currentStep = stepId;
    stepCounter.innerText = historyStack.length === 0 ? "시작 화면" : `단계 ${historyStack.length}`;

    if (node.isResult) {
      stepCounter.innerText = "최종 결과 요약";
      questionText.innerHTML = '';
      additionalInfo.style.display = "none";
      optionsContainer.innerHTML = '';

      if (node.dynamicRender) {
        optionsContainer.innerHTML = node.dynamicRender(answers);
      }
    } else {
      questionText.innerHTML = node.text;
      if (node.info) {
        additionalInfo.innerHTML = node.info;
        additionalInfo.style.display = "block";
      } else {
        additionalInfo.style.display = "none";
      }

      optionsContainer.innerHTML = '';

      if (node.type === "date") {
        optionsContainer.innerHTML = `
          <div>
            <input type="date" id="date-input" class="date-input" max="${new Date().toISOString().split('T')[0]}" required />
          </div>
          <button class="btn-option primary-btn" id="btn-next-date">다음 단계로</button>
        `;
        document.getElementById('btn-next-date').onclick = () => {
          const val = document.getElementById('date-input').value;
          if (!val) { alert("연월일을 정확히 입력해주세요."); return; }
          historyStack.push({ step: currentStep, answersState: JSON.stringify(answers), label: val });
          renderStep(node.action(val));
        };
      } else if (node.type === "number") {
        optionsContainer.innerHTML = `
          <div>
            <input type="number" id="number-input" class="date-input" step="0.1" placeholder="예: -2.5" required />
          </div>
          <button class="btn-option primary-btn" id="btn-next-num">다음 단계로</button>
        `;
        document.getElementById('btn-next-num').onclick = () => {
          const val = document.getElementById('number-input').value;
          if (!val) { alert("숫자를 정확히 입력해주세요."); return; }
          historyStack.push({ step: currentStep, answersState: JSON.stringify(answers), label: val });
          renderStep(node.action(val));
        };
      } else if (node.type === "checkboxes_steroid") {
        optionsContainer.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:1.25rem; margin-bottom:1.5rem; background-color: var(--card-bg); border: 2px solid #e2e8f0; border-radius: 0.75rem; padding: 1.5rem;">
            <label style="display:flex; align-items:center; gap:0.75rem; font-size:1.15rem; cursor:pointer; font-weight:600; color: var(--text-main);">
              <input type="checkbox" id="chk-90" style="transform:scale(1.5); cursor:pointer;">
              90일 넘게 투약하였음
            </label>
            <label style="display:flex; align-items:center; gap:0.75rem; font-size:1.15rem; cursor:pointer; font-weight:600; color: var(--text-main);">
              <input type="checkbox" id="chk-450" style="transform:scale(1.5); cursor:pointer;">
              총 450mg 이상 투약하였음
            </label>
          </div>
          <button class="btn-option primary-btn" id="btn-next-chk">다음 단계로</button>
        `;
        document.getElementById('btn-next-chk').onclick = () => {
          const is90 = document.getElementById('chk-90').checked;
          const is450 = document.getElementById('chk-450').checked;
          let labelStr = [];
          if (is90) labelStr.push("90일 초과");
          if (is450) labelStr.push("450mg 이상");
          historyStack.push({ step: currentStep, answersState: JSON.stringify(answers), label: labelStr.join(", ") || "해당 없음" });
          renderStep(node.action(is90, is450));
        };
      } else {
        node.options.forEach((opt, idx) => {
          const btn = document.createElement('button');
          btn.className = 'btn-option';
          if (opt.disabled) {
            btn.disabled = true;
          }
          btn.style.animation = `fadeIn 0.3s ease ${idx * 0.1}s forwards`;
          btn.style.opacity = '0';

          let labelHtml = `<span>${opt.label}</span>`;
          if (opt.disabled) {
            labelHtml = `<div style="display:flex; flex-direction:column; align-items:center;">
                           <div style="font-size: 0.8rem; background-color:#94a3b8; color:white; padding:0.25rem 0.6rem; border-radius:9999px; font-weight:800; margin-bottom:0.5rem; letter-spacing:0.05em; text-transform:uppercase;">Coming Soon</div>
                           <span>${opt.label}</span>
                         </div>`;
          }

          btn.innerHTML = `${labelHtml}
                           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>`;
          btn.onclick = () => {
            historyStack.push({ step: currentStep, answersState: JSON.stringify(answers), label: opt.label });
            const nextNode = opt.action();
            renderStep(nextNode);
          };
          optionsContainer.appendChild(btn);
        });
      }
    }

    if (historyStack.length > 0) {
      btnBack.classList.remove('hidden');
    } else {
      btnBack.classList.add('hidden');
    }

    card.classList.remove('fade-out');
    card.classList.add('fade-in');
  }, 300);
}

window.goBack = function () {
  if (historyStack.length > 0) {
    const prevState = historyStack.pop();
    answers = JSON.parse(prevState.answersState);
    renderStep(prevState.step);
  }
};

window.resetApp = function () {
  historyStack = [];
  answers = {};
  currentResultStatus = "";
  renderStep('root');
};

// --- 체크리스트 및 요약 기능 추가 ---

const checklistQuestions = {
  bone: [
    { id: 'start', label: '성별' },
    { id: 'age_f', label: '연령대' },
    { id: 'age_m', label: '연령대' },
    { id: 'purpose', label: '검사 이력' },
    { id: 'f_preg_diag', label: '임신성 골절 의심' },
    { id: 'f_meno', label: '폐경 여부' },
    { id: 'f_bmi', label: '저체중 (BMI < 18.5)' },
    { id: 'f_frac', label: '비외상성 골절력' },
    { id: 'f_fam', label: '가족력' },
    { id: 'f_surg', label: '외과적 폐경' },
    { id: 'f_early', label: '조기 자연 폐경' },
    { id: 'f_amen', label: '무월경 (1년 이상)' },
    { id: 'common_disease', label: '골다공증 유발 질환' },
    { id: 'common_drug', label: '골다공증 유발 약물' },
    { id: 'common_must', label: '의학적 필수 소견' },
    { id: 'fu_date', label: '이전 검사일' },
    { id: 'fu_tscore', label: '이전 T-score' },
    { id: 'teen_zscore', label: '이전 Z-score' },
    { id: 'fu_steroid', label: '스테로이드 복용 중' },
    { id: 'fu_pth', label: '부갑상선기능항진증' },
    { id: 'fu_limit_chk', label: '첫 1년 내 2회 검사 여부' }
  ],
  prolia: [
    { id: 'prolia_q1_purpose', label: '투여 대상 기준' },
    { id: 'prolia_steroid_chk', label: '스테로이드 투여 조건' },
    { id: 'prolia_q1_giop_type', label: '성별 및 연령/폐경 상태' },
    { id: 'prolia_q2_date', label: '골밀도 검사 날짜' },
    { id: 'prolia_q3_score_t', label: 'T-score' },
    { id: 'prolia_q3_score_z', label: 'Z-score' },
    { id: 'prolia_q4_has_history', label: '이전 투여 이력' },
    { id: 'prolia_q4_date', label: '마지막 투여 날짜' },
    { id: 'prolia_frac_1', label: '골다공증성 골절(X-ray)' },
    { id: 'prolia_frac_2', label: '진료기록/영상판독지 기록' },
    { id: 'prolia_q8_1', label: '과거 급여 투여 이력' },
    { id: 'prolia_q8_2', label: '최초 투여 당시 수치' },
    { id: 'prolia_q11', label: '호전 후 투여 횟수' }
  ]
};

window.showChecklist = function () {
  const container = document.getElementById('checklist-container');
  const questions = checklistQuestions[appMode] || [];

  let html = '';
  questions.forEach(q => {
    const historyItem = historyStack.find(h => h.step === q.id);
    const isChecked = !!historyItem;
    const answerLabel = isChecked ? historyItem.label : '';

    html += `
      <div class="checklist-item ${isChecked ? 'checked' : ''}">
        <div class="check-icon">${isChecked ? '✓' : ''}</div>
        <div class="label-group" style="display:flex; flex-direction:column;">
          <span class="label">${q.label}</span>
          ${isChecked ? `<span style="font-size:0.8rem; color:var(--primary); font-weight:700;">→ ${answerLabel}</span>` : ''}
        </div>
      </div>
    `;
  });

  const summary = generateSummary();
  const summaryHtml = `
    <div class="summary-box" style="margin-top: 1rem; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 0.75rem; padding: 1rem; position: relative;">
      <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.5rem; font-weight: 700;">[의무기록용 요약]</div>
      <div class="summary-text" id="summary-content" style="font-size: 0.85rem; color: var(--text-main); line-height: 1.4; word-break: break-all; padding-right: 2rem;">${summary}</div>
      <button class="btn-copy-icon" onclick="copyToClipboard(document.getElementById('summary-content').innerText)" title="복사하기" style="position: absolute; top: 0.75rem; right: 0.75rem; background: white; border: 1px solid #e2e8f0; border-radius: 0.375rem; padding: 0.4rem; cursor: pointer;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      </button>
      <div id="copy-tip" class="copy-success-tip">복사되었습니다!</div>
    </div>
  `;

  container.innerHTML = html + summaryHtml;
  document.getElementById('checklist-modal').classList.remove('hidden');
};

window.closeChecklist = function () {
  document.getElementById('checklist-modal').classList.add('hidden');
};

window.generateSummary = function () {
  // FILTER 판별 근거 형식 생성: {항목명}: {선택값} 형식
  const questions = checklistQuestions[appMode] || [];
  const items = [];

  questions.forEach(q => {
    const historyItem = historyStack.find(h => h.step === q.id);
    if (historyItem) {
      items.push(`${q.label}: ${historyItem.label}`);
    }
  });

  const dateStr = new Date().toISOString().split('T')[0];
  const summary = `${items.join(' / ')} / ${currentResultStatus} (${dateStr})`;
  return summary;
};

window.copyToClipboard = function (text, btnId) {
  navigator.clipboard.writeText(text).then(() => {
    const tip = document.getElementById('copy-tip');
    tip.classList.add('show');
    setTimeout(() => tip.classList.remove('show'), 2000);
  });
};

function getResultActionHtml() {
  return `
    <div class="result-actions">
      <button class="btn-option primary-btn" onclick="showChecklist()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:0.5rem;"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
        내가 선택한 항목 한눈에 보기
      </button>
    </div>
    <div class="email-collection-box" style="margin-top: 2rem; padding: 1.5rem; background-color: var(--primary-light); border-radius: 0.75rem; border: 1px solid #bfdbfe; text-align: center;">
      <div style="font-size: 1.1rem; font-weight: 700; color: var(--primary-hover); margin-bottom: 0.5rem;">
        골밀도는 시작일 뿐입니다.
      </div>
      <div style="font-size: 0.95rem; color: #475569; margin-bottom: 1rem; line-height: 1.5; word-break: keep-all;">
        수익을 지켜줄 다음 도구(프롤리아, MRI, 신경차단술 등)가 출시되면 가장 먼저 알려드릴게요!
      </div>
      <form id="subscribe-form" class="email-form" onsubmit="submitEmailForm(event)">
        <input type="email" id="subscriber-email" name="email" placeholder="youremail@email.com" required style="width: 100%; padding: 0.8rem 1rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; margin-bottom: 0.75rem; font-size: 0.95rem; outline: none; box-sizing: border-box;">
        <button type="submit" id="subscribe-btn" style="width: 100%; padding: 0.8rem 1rem; background-color: var(--primary); color: white; border: none; border-radius: 0.5rem; font-size: 1rem; font-weight: 700; cursor: pointer; transition: background-color 0.2s;">
          다음 도구 가장 먼저 사용하기
        </button>
      </form>
    </div>
  `;
}

// Static Forms 전송 로직
window.submitEmailForm = async function (e) {
  e.preventDefault();

  const btn = document.getElementById('subscribe-btn');
  const emailInput = document.getElementById('subscriber-email');
  const email = emailInput.value;

  // Static Forms 연동을 위한 Access Key 입력
  // 발급받은 키를 아래 문자열에 넣어주세요. 예: "e6xxx..."
  const STATIC_FORMS_ACCESS_KEY = "sf_bc115256bf736f36a6c2bf3f";

  btn.innerText = "등록 중...";
  btn.style.opacity = "0.7";
  btn.disabled = true;

  try {
    const res = await fetch("https://api.staticforms.xyz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessKey: STATIC_FORMS_ACCESS_KEY,
        email: email,
        subject: "의료 급여기준 판별기 - 새 이메일 구독 등록"
      })
    });

    const data = await res.json();
    if (data.success) {
      alert("이메일이 성공적으로 등록되었습니다!");
      emailInput.value = "";
      btn.innerText = "등록 완료 ✓";
      btn.style.backgroundColor = "var(--success)";
    } else {
      alert("등록에 실패했습니다. 다시 시도해주세요.");
      btn.innerText = "다음 도구 가장 먼저 사용하기";
      btn.style.opacity = "1";
      btn.disabled = false;
    }
  } catch (err) {
    alert("네트워크 오류가 발생했습니다.");
    btn.innerText = "다음 도구 가장 먼저 사용하기";
    btn.style.opacity = "1";
    btn.disabled = false;
  }
};
