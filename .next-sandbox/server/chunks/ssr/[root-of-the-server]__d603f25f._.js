module.exports=[93695,(a,b,c)=>{b.exports=a.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},50645,a=>{a.n(a.i(27572))},43619,a=>{a.n(a.i(79962))},13718,a=>{a.n(a.i(85523))},18198,a=>{a.n(a.i(45518))},62212,a=>{a.n(a.i(66114))},83730,a=>{a.n(a.i(15689))},57764,(a,b,c)=>{b.exports=a.x("node:url",()=>require("node:url"))},57328,(a,b,c)=>{b.exports=a.x("node:assert",()=>require("node:assert"))},2157,(a,b,c)=>{b.exports=a.x("node:fs",()=>require("node:fs"))},1269,a=>{"use strict";var b=a.i(717);let c=(...a)=>a.filter((a,b,c)=>!!a&&""!==a.trim()&&c.indexOf(a)===b).join(" ").trim(),d=a=>{let b=a.replace(/^([A-Z])|[\s-_]+(\w)/g,(a,b,c)=>c?c.toUpperCase():b.toLowerCase());return b.charAt(0).toUpperCase()+b.slice(1)};var e={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};let f=(0,b.forwardRef)(({color:a="currentColor",size:d=24,strokeWidth:f=2,absoluteStrokeWidth:g,className:h="",children:i,iconNode:j,...k},l)=>(0,b.createElement)("svg",{ref:l,...e,width:d,height:d,stroke:a,strokeWidth:g?24*Number(f)/Number(d):f,className:c("lucide",h),...!i&&!(a=>{for(let b in a)if(b.startsWith("aria-")||"role"===b||"title"===b)return!0;return!1})(k)&&{"aria-hidden":"true"},...k},[...j.map(([a,c])=>(0,b.createElement)(a,c)),...Array.isArray(i)?i:[i]])),g=(a,e)=>{let g=(0,b.forwardRef)(({className:g,...h},i)=>(0,b.createElement)(f,{ref:i,iconNode:e,className:c(`lucide-${d(a).replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase()}`,`lucide-${a}`,g),...h}));return g.displayName=d(a),g};a.s(["default",()=>g],1269)},28407,a=>{"use strict";let b=(0,a.i(1269).default)("triangle-alert",[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]]);a.s(["AlertTriangle",()=>b],28407)},64803,a=>a.a(async(b,c)=>{try{a.i(24868),a.i(14747);var d=a.i(27788),e=a.i(60909),f=b([d,e]);async function g(a){await a.query(`
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
      `)]),f=a.rows[0]??{},h=c.rows.map(a=>({evaluationDatasetVersion:String(a.evaluation_dataset_version),modelVersion:String(a.model_version),analysisVersion:String(a.analysis_version),sampleCount:Number(a.sample_count??0),latestCapturedAt:a.latest_captured_at?String(a.latest_captured_at):null,avgPronunciationScore:Number(a.avg_pronunciation_score??0),avgConsonantAccuracy:Number(a.avg_consonant_accuracy??0),avgVowelAccuracy:Number(a.avg_vowel_accuracy??0),avgTrackingQuality:Number(a.avg_tracking_quality??0)})),i=h[0]??null,j=h[1]??null;return{totalCount:Number(f.total_count??0),measuredCount:Number(f.measured_count??0),latestCapturedAt:f.latest_captured_at?String(f.latest_captured_at):null,versions:h,latestVersionComparison:i&&j?{current:i,previous:j,sampleDelta:i.sampleCount-j.sampleCount,pronunciationDelta:i.avgPronunciationScore-j.avgPronunciationScore,consonantDelta:i.avgConsonantAccuracy-j.avgConsonantAccuracy,vowelDelta:i.avgVowelAccuracy-j.avgVowelAccuracy,trackingDelta:i.avgTrackingQuality-j.avgTrackingQuality}:null,modeBreakdown:d.rows.map(a=>({trainingMode:String(a.training_mode),sampleCount:Number(a.sample_count??0)})),qualityBreakdown:e.rows.map(a=>({quality:String(a.quality),sampleCount:Number(a.sample_count??0)}))}}finally{b.release()}}[d,e]=f.then?(await f)():f,a.s(["getEvaluationSamplesSummary",()=>h]),c()}catch(a){c(a)}},!1)];

//# sourceMappingURL=%5Broot-of-the-server%5D__d603f25f._.js.map