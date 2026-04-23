module.exports=[93695,(a,b,c)=>{b.exports=a.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},50645,a=>{a.n(a.i(27572))},43619,a=>{a.n(a.i(79962))},13718,a=>{a.n(a.i(85523))},18198,a=>{a.n(a.i(45518))},62212,a=>{a.n(a.i(66114))},83730,a=>{a.n(a.i(15689))},64803,a=>a.a(async(b,c)=>{try{a.i(24868),a.i(14747);var d=a.i(27788),e=a.i(60909),f=b([d,e]);async function g(a){await a.query(`
    CREATE TABLE IF NOT EXISTS ai_evaluation_samples (
      sample_id uuid PRIMARY KEY,
      source_history_id text NOT NULL,
      source_session_id text NOT NULL,
      patient_pseudonym_id text NOT NULL,
      training_mode text NOT NULL,
      rehab_step integer NULL,
      utterance_id text NOT NULL,
      quality text NOT NULL,
      prompt_text text NOT NULL,
      transcript_text text NOT NULL,
      consonant_accuracy double precision NOT NULL DEFAULT 0,
      vowel_accuracy double precision NOT NULL DEFAULT 0,
      pronunciation_score double precision NOT NULL DEFAULT 0,
      symmetry_score double precision NOT NULL DEFAULT 0,
      tracking_quality double precision NOT NULL DEFAULT 0,
      processing_ms double precision NOT NULL DEFAULT 0,
      fps double precision NOT NULL DEFAULT 0,
      model_version text NOT NULL,
      analysis_version text NOT NULL,
      evaluation_dataset_version text NOT NULL,
      captured_at timestamptz NOT NULL,
      governance jsonb NULL,
      sample_payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      UNIQUE (source_history_id, utterance_id)
    )
  `)}async function h(){let a=(0,d.getDbPool)(),b=await a.connect();try{await g(b);let[a,c,d,e]=await Promise.all([b.query(`
        SELECT
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (WHERE quality = 'measured')::int AS measured_count,
          MAX(captured_at)::text AS latest_captured_at
        FROM ai_evaluation_samples
      `),b.query(`
        SELECT
          evaluation_dataset_version,
          model_version,
          analysis_version,
          COUNT(*)::int AS sample_count,
          MAX(captured_at)::text AS latest_captured_at,
          AVG(pronunciation_score)::double precision AS avg_pronunciation_score,
          AVG(consonant_accuracy)::double precision AS avg_consonant_accuracy,
          AVG(vowel_accuracy)::double precision AS avg_vowel_accuracy,
          AVG(tracking_quality)::double precision AS avg_tracking_quality
        FROM ai_evaluation_samples
        GROUP BY evaluation_dataset_version, model_version, analysis_version
        ORDER BY latest_captured_at DESC NULLS LAST
        LIMIT 10
      `),b.query(`
        SELECT
          training_mode,
          COUNT(*)::int AS sample_count
        FROM ai_evaluation_samples
        GROUP BY training_mode
        ORDER BY sample_count DESC, training_mode ASC
      `),b.query(`
        SELECT
          quality,
          COUNT(*)::int AS sample_count
        FROM ai_evaluation_samples
        GROUP BY quality
        ORDER BY sample_count DESC, quality ASC
      `)]),f=a.rows[0]??{},h=c.rows.map(a=>({evaluationDatasetVersion:String(a.evaluation_dataset_version),modelVersion:String(a.model_version),analysisVersion:String(a.analysis_version),sampleCount:Number(a.sample_count??0),latestCapturedAt:a.latest_captured_at?String(a.latest_captured_at):null,avgPronunciationScore:Number(a.avg_pronunciation_score??0),avgConsonantAccuracy:Number(a.avg_consonant_accuracy??0),avgVowelAccuracy:Number(a.avg_vowel_accuracy??0),avgTrackingQuality:Number(a.avg_tracking_quality??0)})),i=h[0]??null,j=h[1]??null;return{totalCount:Number(f.total_count??0),measuredCount:Number(f.measured_count??0),latestCapturedAt:f.latest_captured_at?String(f.latest_captured_at):null,versions:h,latestVersionComparison:i&&j?{current:i,previous:j,sampleDelta:i.sampleCount-j.sampleCount,pronunciationDelta:i.avgPronunciationScore-j.avgPronunciationScore,consonantDelta:i.avgConsonantAccuracy-j.avgConsonantAccuracy,vowelDelta:i.avgVowelAccuracy-j.avgVowelAccuracy,trackingDelta:i.avgTrackingQuality-j.avgTrackingQuality}:null,modeBreakdown:d.rows.map(a=>({trainingMode:String(a.training_mode),sampleCount:Number(a.sample_count??0)})),qualityBreakdown:e.rows.map(a=>({quality:String(a.quality),sampleCount:Number(a.sample_count??0)}))}}finally{b.release()}}[d,e]=f.then?(await f)():f,a.s(["getEvaluationSamplesSummary",()=>h]),c()}catch(a){c(a)}},!1),71387,a=>a.a(async(b,c)=>{try{var d=a.i(7997),e=a.i(95936),f=a.i(64803),g=b([f]);function h(a){if(!a)return"기록 없음";let b=new Date(a);return Number.isNaN(b.getTime())?"기록 없음":b.toLocaleString("ko-KR",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}function i(a,b=1){let c=a.toFixed(b);return a>0?`+${c}`:c}async function j(){let a=await (0,f.getEvaluationSamplesSummary)();return(0,d.jsxs)("section",{className:"space-y-6",children:[(0,d.jsxs)("article",{className:"rounded-[32px] border border-violet-200 bg-gradient-to-r from-violet-600 to-fuchsia-600 p-6 text-white shadow-sm sm:p-8",children:[(0,d.jsx)("p",{className:"text-[11px] font-black uppercase tracking-[0.22em] text-violet-100",children:"AI Evaluation Ops"}),(0,d.jsx)("h2",{className:"mt-3 text-2xl font-black tracking-tight sm:text-3xl",children:"measured-only 평가셋 운영 상태와 버전 비교를 확인합니다."}),(0,d.jsx)("p",{className:"mt-3 max-w-3xl text-sm font-medium leading-6 text-violet-50/90",children:"dataset version, model version, analysis version 조합별 샘플 수와 평균 지표를 비교해 공인평가용 데이터셋 운영 상태를 점검합니다."}),(0,d.jsx)("div",{className:"mt-6 flex flex-wrap gap-2",children:(0,d.jsx)(e.default,{href:"/therapist/system",className:"rounded-full bg-white px-4 py-2 text-sm font-black text-violet-700 transition hover:bg-violet-50",children:"시스템 개요로 돌아가기"})})]}),(0,d.jsxs)("section",{className:"grid gap-4 lg:grid-cols-4",children:[(0,d.jsx)(k,{label:"전체 샘플",value:String(a.totalCount),note:"ai_evaluation_samples 기준"}),(0,d.jsx)(k,{label:"measured 샘플",value:String(a.measuredCount),note:"공식 평가 진입 가능 샘플"}),(0,d.jsx)(k,{label:"버전 조합",value:String(a.versions.length),note:"dataset / model / analysis"}),(0,d.jsx)(k,{label:"최근 적재",value:h(a.latestCapturedAt),note:"latest captured_at"})]}),(0,d.jsxs)("section",{className:"grid gap-6 xl:grid-cols-[1.2fr_0.8fr]",children:[(0,d.jsxs)("article",{className:"rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8",children:[(0,d.jsx)("div",{className:"flex items-center justify-between gap-4",children:(0,d.jsxs)("div",{children:[(0,d.jsx)("p",{className:"text-[11px] font-black uppercase tracking-[0.18em] text-slate-500",children:"Version Comparison"}),(0,d.jsx)("h3",{className:"mt-2 text-xl font-black text-slate-950",children:"버전 조합별 샘플/평균 지표"})]})}),(0,d.jsx)("div",{className:"mt-5 overflow-x-auto",children:(0,d.jsxs)("table",{className:"min-w-full border-separate border-spacing-y-2 text-left",children:[(0,d.jsx)("thead",{children:(0,d.jsxs)("tr",{className:"text-xs font-black uppercase tracking-[0.14em] text-slate-500",children:[(0,d.jsx)("th",{className:"px-3 py-2",children:"Dataset"}),(0,d.jsx)("th",{className:"px-3 py-2",children:"Model / Analysis"}),(0,d.jsx)("th",{className:"px-3 py-2",children:"샘플"}),(0,d.jsx)("th",{className:"px-3 py-2",children:"발음"}),(0,d.jsx)("th",{className:"px-3 py-2",children:"자음"}),(0,d.jsx)("th",{className:"px-3 py-2",children:"모음"}),(0,d.jsx)("th",{className:"px-3 py-2",children:"추적"}),(0,d.jsx)("th",{className:"px-3 py-2",children:"최근 적재"})]})}),(0,d.jsx)("tbody",{children:a.versions.length?a.versions.map(a=>(0,d.jsxs)("tr",{className:"rounded-2xl bg-slate-50 text-sm font-medium text-slate-700",children:[(0,d.jsx)("td",{className:"rounded-l-2xl px-3 py-3 font-black text-slate-900",children:a.evaluationDatasetVersion}),(0,d.jsxs)("td",{className:"px-3 py-3",children:["model ",a.modelVersion,(0,d.jsx)("br",{}),(0,d.jsxs)("span",{className:"text-xs text-slate-500",children:["analysis ",a.analysisVersion]})]}),(0,d.jsx)("td",{className:"px-3 py-3",children:a.sampleCount}),(0,d.jsx)("td",{className:"px-3 py-3",children:a.avgPronunciationScore.toFixed(1)}),(0,d.jsx)("td",{className:"px-3 py-3",children:a.avgConsonantAccuracy.toFixed(1)}),(0,d.jsx)("td",{className:"px-3 py-3",children:a.avgVowelAccuracy.toFixed(1)}),(0,d.jsx)("td",{className:"px-3 py-3",children:a.avgTrackingQuality.toFixed(2)}),(0,d.jsx)("td",{className:"rounded-r-2xl px-3 py-3",children:h(a.latestCapturedAt)})]},`${a.evaluationDatasetVersion}-${a.modelVersion}-${a.analysisVersion}`)):(0,d.jsx)("tr",{children:(0,d.jsx)("td",{colSpan:8,className:"px-3 py-8 text-center text-sm font-medium text-slate-500",children:"아직 적재된 평가셋 버전 정보가 없습니다."})})})]})})]}),(0,d.jsxs)("div",{className:"space-y-6",children:[(0,d.jsxs)("article",{className:"rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8",children:[(0,d.jsx)("p",{className:"text-[11px] font-black uppercase tracking-[0.18em] text-slate-500",children:"Latest Delta"}),(0,d.jsx)("h3",{className:"mt-2 text-xl font-black text-slate-950",children:"최근 두 버전 비교"}),a.latestVersionComparison?(0,d.jsxs)("div",{className:"mt-5 space-y-3 text-sm font-medium text-slate-700",children:[(0,d.jsxs)("div",{className:"rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3",children:[(0,d.jsxs)("p",{className:"font-black text-slate-900",children:["현재 ",a.latestVersionComparison.current.evaluationDatasetVersion]}),(0,d.jsxs)("p",{className:"mt-1 text-xs text-slate-500",children:["model ",a.latestVersionComparison.current.modelVersion," · analysis"," ",a.latestVersionComparison.current.analysisVersion]})]}),(0,d.jsxs)("div",{className:"grid gap-3 sm:grid-cols-2",children:[(0,d.jsx)(l,{label:"샘플 변화",value:i(a.latestVersionComparison.sampleDelta,0)}),(0,d.jsx)(l,{label:"발음 변화",value:i(a.latestVersionComparison.pronunciationDelta)}),(0,d.jsx)(l,{label:"자음 변화",value:i(a.latestVersionComparison.consonantDelta)}),(0,d.jsx)(l,{label:"모음 변화",value:i(a.latestVersionComparison.vowelDelta)}),(0,d.jsx)(l,{label:"추적 변화",value:i(a.latestVersionComparison.trackingDelta,2)})]})]}):(0,d.jsx)("p",{className:"mt-4 text-sm font-medium leading-6 text-slate-600",children:"비교할 두 개 이상의 버전 조합이 아직 없습니다."})]}),(0,d.jsxs)("article",{className:"rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8",children:[(0,d.jsx)("p",{className:"text-[11px] font-black uppercase tracking-[0.18em] text-slate-500",children:"Breakdown"}),(0,d.jsx)("h3",{className:"mt-2 text-xl font-black text-slate-950",children:"모드/품질 분포"}),(0,d.jsxs)("div",{className:"mt-5 grid gap-4 md:grid-cols-2",children:[(0,d.jsxs)("div",{className:"rounded-2xl border border-slate-200 bg-slate-50 p-4",children:[(0,d.jsx)("p",{className:"text-xs font-black uppercase tracking-[0.14em] text-slate-500",children:"Training Mode"}),(0,d.jsx)("div",{className:"mt-3 space-y-2",children:a.modeBreakdown.map(a=>(0,d.jsxs)("div",{className:"flex items-center justify-between text-sm font-medium text-slate-700",children:[(0,d.jsx)("span",{children:a.trainingMode}),(0,d.jsx)("span",{className:"font-black text-slate-900",children:a.sampleCount})]},a.trainingMode))})]}),(0,d.jsxs)("div",{className:"rounded-2xl border border-slate-200 bg-slate-50 p-4",children:[(0,d.jsx)("p",{className:"text-xs font-black uppercase tracking-[0.14em] text-slate-500",children:"Quality"}),(0,d.jsx)("div",{className:"mt-3 space-y-2",children:a.qualityBreakdown.map(a=>(0,d.jsxs)("div",{className:"flex items-center justify-between text-sm font-medium text-slate-700",children:[(0,d.jsx)("span",{children:a.quality}),(0,d.jsx)("span",{className:"font-black text-slate-900",children:a.sampleCount})]},a.quality))})]})]})]})]})]})]})}function k({label:a,value:b,note:c}){return(0,d.jsxs)("div",{className:"rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm",children:[(0,d.jsx)("p",{className:"text-[11px] font-black uppercase tracking-[0.18em] text-slate-500",children:a}),(0,d.jsx)("p",{className:"mt-2 text-2xl font-black text-slate-950",children:b}),(0,d.jsx)("p",{className:"mt-2 text-sm font-medium leading-6 text-slate-600",children:c})]})}function l({label:a,value:b}){return(0,d.jsxs)("div",{className:"rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3",children:[(0,d.jsx)("p",{className:"text-xs font-black uppercase tracking-[0.14em] text-slate-500",children:a}),(0,d.jsx)("p",{className:"mt-2 text-lg font-black text-slate-950",children:b})]})}[f]=g.then?(await g)():g,a.s(["default",()=>j]),c()}catch(a){c(a)}},!1)];

//# sourceMappingURL=%5Broot-of-the-server%5D__01ea06bf._.js.map