module ClinicalConstants
  ACCEPTED_FILE_TYPES = ".pdf,.txt,.csv,.md,.xml,.json,.tsv,.hl7"

  RECRUITER_KITS = [
    {
      id: "discharge-summary",
      category: "Core Workbench",
      title: "Discharge Summary Review",
      summary: "Medication reconciliation plus follow-up verification use case.",
      sample_asset_path: "/samples/sample-discharge-summary.pdf",
      sample_asset_label: "Open Sample PDF",
      note_length_label: "Short Case",
      scoring_rubric: nil,
      sample_context: <<~CONTEXT.strip,
        Patient: Maria Chen (DOB: 1978-02-11)
        MRN: 4459012
        Admit Date: 2026-01-09
        Discharge Date: 2026-01-13
        Primary Diagnosis: Community-acquired pneumonia
        Comorbidities: Type 2 diabetes mellitus, hypertension
        Imaging: CXR showed right lower lobe infiltrate
        Lab highlights: WBC 13.1 K/uL on admission -> 8.2 K/uL at discharge
        Creatinine remained stable at 0.9 mg/dL
        Treatment: Ceftriaxone IV then oral azithromycin
        Discharge meds: azithromycin 250 mg daily x 3 days
        Follow-up: PCP visit in 7 days, repeat chest x-ray in 6 weeks
      CONTEXT
      prompts: [
        "List all discharge medications and associated durations.",
        "What objective evidence suggests improvement before discharge?",
        "Identify follow-up actions and their timelines."
      ]
    },
    {
      id: "lab-trend",
      category: "Core Workbench",
      title: "Lab Trend Integrity Check",
      summary: "Flag abnormal values and compare with plan-of-care alignment.",
      sample_asset_path: "/samples/sample-lab-trend-report.pdf",
      sample_asset_label: "Open Sample PDF",
      note_length_label: "Short Case",
      scoring_rubric: nil,
      sample_context: <<~CONTEXT.strip,
        Patient: Derek Wallace (DOB: 1965-09-27)
        Encounter Date: 2026-02-20
        Reason: fatigue and mild dyspnea
        CBC: Hgb 9.4 g/dL (low), Hct 29.1% (low), MCV 72 fL (low)
        Iron studies: ferritin 8 ng/mL (low), transferrin saturation 9% (low)
        CMP: Na 138, K 4.2, BUN 18, Creatinine 1.0
        A1c: 7.8%
        TSH: 2.1 mIU/L
        Assessment note: Findings consistent with iron deficiency anemia
        Plan: start ferrous sulfate 325 mg PO every other day; repeat CBC in 4 weeks
      CONTEXT
      prompts: [
        "Summarize all abnormal labs and their directionality.",
        "Does the documented assessment match the provided labs?",
        "What monitoring steps are explicitly documented in the plan?"
      ]
    },
    {
      id: "icu-septic-shock",
      category: "ICU Patients",
      title: "ICU Longitudinal Review: Septic Shock and ARDS",
      summary: "Multi-week surgical ICU stay with source control, ARDS, CRRT, tracheostomy, delirium, and competing complications.",
      sample_asset_path: "/samples/icu-septic-shock-case.txt",
      sample_asset_label: "Download ICU Case File",
      note_length_label: "Long ICU Case",
      scoring_rubric: [
        "Timeline fidelity: Correct sequence and date/day alignment for source control, ventilator changes, CRRT, tracheostomy, and transfer milestones.",
        "Complication synthesis: Clearly identifies each major complication, cites objective evidence, and states resolved vs unresolved status at transfer.",
        "Clinical reasoning quality: Distinguishes correlation from causation and explains why major management pivots occurred.",
        "Grounding and traceability: Uses specific chart facts/labs/events from the note rather than generic ICU language."
      ],
      sample_context: :icu_septic_shock,
      prompts: [
        "Build a day-by-day ICU timeline covering shock, ventilation, renal replacement therapy, and source control.",
        "Which events most strongly justified tracheostomy, and what objective evidence shows the patient was improving by transfer?",
        "Summarize every major complication, when it appeared, and whether it was resolved or still active at transfer."
      ]
    },
    {
      id: "icu-post-cabg",
      category: "ICU Patients",
      title: "ICU Longitudinal Review: Post-CABG Cardiogenic Shock",
      summary: "Complex cardiothoracic ICU course with VA-ECMO, CRRT, embolic strokes, GI bleeding, failed extubation, and recovery planning.",
      sample_asset_path: "/samples/icu-post-cabg-case.txt",
      sample_asset_label: "Download ICU Case File",
      note_length_label: "Long ICU Case",
      scoring_rubric: [
        "Hemodynamic support accuracy: Correctly tracks rationale and timing of IABP, VA-ECMO, inotropes, decannulation, and recovery signals.",
        "Risk balancing analysis: Explains anticoagulation decisions in context of stroke, bleeding, and postoperative instability.",
        "Cross-domain integration: Connects cardiology, neurologic, renal, respiratory, and GI events into a coherent ICU narrative.",
        "Transfer readiness assessment: Uses explicit objective findings to justify why CTICU transfer was appropriate despite residual risk."
      ],
      sample_context: :icu_post_cabg,
      prompts: [
        "Create a concise but complete timeline of hemodynamic support, including when VA-ECMO, IABP, inotropes, and CRRT were started and stopped.",
        "Explain how the team balanced anticoagulation against bleeding and stroke risk across the ICU stay.",
        "What unresolved clinical risks remained at transfer, and what evidence shows the patient had recovered enough to leave the CTICU?"
      ]
    }
  ].freeze

  def self.kit_context(kit)
    case kit[:sample_context]
    when :icu_septic_shock
      IcuContexts::SEPTIC_SHOCK
    when :icu_post_cabg
      IcuContexts::POST_CABG
    else
      kit[:sample_context]
    end
  end
end
