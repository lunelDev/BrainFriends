module.exports=[70406,(e,t,a)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,a)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},23862,e=>e.a(async(t,a)=>{try{let t=await e.y("pg-587764f78a6c7a9c");e.n(t),a()}catch(e){a(e)}},!0),24868,(e,t,a)=>{t.exports=e.x("fs/promises",()=>require("fs/promises"))},18622,(e,t,a)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},14747,(e,t,a)=>{t.exports=e.x("path",()=>require("path"))},54799,(e,t,a)=>{t.exports=e.x("crypto",()=>require("crypto"))},63528,e=>e.a(async(t,a)=>{try{var n=e.i(23862),r=t([n]);[n]=r.then?(await r)():r;let s=process.env.DATABASE_URL;function i(){if(!s)throw Error("missing_database_url");return global.__brainfriendsPgPool||(global.__brainfriendsPgPool=new n.Pool({connectionString:s,ssl:"require"===process.env.DATABASE_SSL&&{rejectUnauthorized:!1}})),global.__brainfriendsPgPool}s||console.warn("[db] DATABASE_URL is not configured. Database writes are disabled."),e.s(["getDbPool",()=>i]),a()}catch(e){a(e)}},!1),77545,e=>e.a(async(t,a)=>{try{var n=e.i(54799),r=e.i(63528),i=t([r]);function s(e){return(0,n.createHash)("sha256").update(e).digest("hex")}function o(e){let t=s(e).slice(0,32).split("");t[12]="5",t[16]=(3&parseInt(t[16],16)|8).toString(16);let a=t.join("");return`${a.slice(0,8)}-${a.slice(8,12)}-${a.slice(12,16)}-${a.slice(16,20)}-${a.slice(20,32)}`}function l(e){return[e.name.trim(),e.birthDate??"",e.gender,e.phone??"",e.language??"ko"].join("|")}function c(e){let t=l(e);return`psn_${s(t).slice(0,24)}`}async function u(e,t){let a=l(t),n=o(`patient:${a}`),r=`PT-${n.slice(0,8).toUpperCase()}`,i=c(t);return await e.query(`
      INSERT INTO patient_pii (
        patient_id,
        patient_code,
        full_name,
        birth_date,
        sex,
        phone,
        language,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (patient_id) DO UPDATE
      SET
        patient_code = EXCLUDED.patient_code,
        full_name = EXCLUDED.full_name,
        birth_date = EXCLUDED.birth_date,
        sex = EXCLUDED.sex,
        phone = EXCLUDED.phone,
        language = EXCLUDED.language,
        updated_at = NOW()
    `,[n,r,t.name.trim(),t.birthDate||null,t.gender||"U",t.phone||null,t.language||"ko"]),await e.query(`
      INSERT INTO patient_pseudonym_map (
        patient_pseudonym_id,
        patient_id,
        mapping_version,
        created_at
      )
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (patient_pseudonym_id) DO UPDATE
      SET
        patient_id = EXCLUDED.patient_id,
        mapping_version = EXCLUDED.mapping_version
    `,[i,n,"pseudonym-map-v1"]),{patientId:n,patientCode:r,patientPseudonymId:i}}async function d(e){let t=(0,r.getDbPool)(),a=await t.connect();try{await a.query("BEGIN");let t=await u(a,e);return await a.query("COMMIT"),t}catch(e){throw await a.query("ROLLBACK"),e}finally{a.release()}}[r]=i.then?(await i)():i,e.s(["buildPatientPseudonymId",()=>c,"deterministicUuid",()=>o,"ensurePatientIdentity",()=>d,"hashValue",()=>s,"upsertPatientIdentity",()=>u]),a()}catch(e){a(e)}},!1),23722,e=>e.a(async(t,a)=>{try{var n=e.i(24868),r=e.i(14747),i=e.i(63528),s=e.i(77545),o=t([i,s]);async function l(e){await e.query(`
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
  `)}async function c(e){let t=r.default.join(process.cwd(),"data","evaluation"),a=r.default.join(t,"evaluation-samples.ndjson");await (0,n.mkdir)(t,{recursive:!0});let i=e.samples.map(t=>JSON.stringify({historyId:e.historyId,sessionId:e.sessionId,governance:e.governance??null,sample:t,recordedAt:new Date().toISOString()}));return await (0,n.appendFile)(a,`${i.join("\n")}
`,"utf8"),{accepted:e.samples.length,storageTarget:"file",path:a}}async function u(e){let t=(0,i.getDbPool)(),a=await t.connect();try{for(let t of(await a.query("BEGIN"),await l(a),e.samples))await a.query(`
          INSERT INTO ai_evaluation_samples (
            sample_id,
            source_history_id,
            source_session_id,
            patient_pseudonym_id,
            training_mode,
            rehab_step,
            utterance_id,
            quality,
            prompt_text,
            transcript_text,
            consonant_accuracy,
            vowel_accuracy,
            pronunciation_score,
            symmetry_score,
            tracking_quality,
            processing_ms,
            fps,
            model_version,
            analysis_version,
            evaluation_dataset_version,
            captured_at,
            governance,
            sample_payload,
            updated_at
          )
          VALUES (
            $1::uuid,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            $17,
            $18,
            $19,
            $20,
            $21::timestamptz,
            $22::jsonb,
            $23::jsonb,
            NOW()
          )
          ON CONFLICT (source_history_id, utterance_id) DO UPDATE
          SET
            source_session_id = EXCLUDED.source_session_id,
            patient_pseudonym_id = EXCLUDED.patient_pseudonym_id,
            training_mode = EXCLUDED.training_mode,
            rehab_step = EXCLUDED.rehab_step,
            quality = EXCLUDED.quality,
            prompt_text = EXCLUDED.prompt_text,
            transcript_text = EXCLUDED.transcript_text,
            consonant_accuracy = EXCLUDED.consonant_accuracy,
            vowel_accuracy = EXCLUDED.vowel_accuracy,
            pronunciation_score = EXCLUDED.pronunciation_score,
            symmetry_score = EXCLUDED.symmetry_score,
            tracking_quality = EXCLUDED.tracking_quality,
            processing_ms = EXCLUDED.processing_ms,
            fps = EXCLUDED.fps,
            model_version = EXCLUDED.model_version,
            analysis_version = EXCLUDED.analysis_version,
            evaluation_dataset_version = EXCLUDED.evaluation_dataset_version,
            captured_at = EXCLUDED.captured_at,
            governance = EXCLUDED.governance,
            sample_payload = EXCLUDED.sample_payload,
            updated_at = NOW()
        `,[(0,s.deterministicUuid)(`evaluation-sample:${t.historyId}:${t.utteranceId}:${t.evaluationDatasetVersion}`),e.historyId,e.sessionId,`eval_${(0,s.hashValue)(`patient:${t.patientId}`).slice(0,24)}`,t.trainingMode,t.rehabStep,t.utteranceId,t.quality,t.prompt,t.transcript,t.consonantAccuracy,t.vowelAccuracy,t.pronunciationScore,t.symmetryScore,t.trackingQuality,t.processingMs,t.fps,t.modelVersion,t.analysisVersion,t.evaluationDatasetVersion,t.capturedAt,e.governance?JSON.stringify(e.governance):null,JSON.stringify(t)]);return await a.query("COMMIT"),{accepted:e.samples.length,storageTarget:"database"}}catch(e){throw await a.query("ROLLBACK"),e}finally{a.release()}}async function d(){let e=(0,i.getDbPool)(),t=await e.connect();try{await l(t);let[e,a,n,r]=await Promise.all([t.query(`
        SELECT
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (WHERE quality = 'measured')::int AS measured_count,
          MAX(captured_at)::text AS latest_captured_at
        FROM ai_evaluation_samples
      `),t.query(`
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
      `),t.query(`
        SELECT
          training_mode,
          COUNT(*)::int AS sample_count
        FROM ai_evaluation_samples
        GROUP BY training_mode
        ORDER BY sample_count DESC, training_mode ASC
      `),t.query(`
        SELECT
          quality,
          COUNT(*)::int AS sample_count
        FROM ai_evaluation_samples
        GROUP BY quality
        ORDER BY sample_count DESC, quality ASC
      `)]),i=e.rows[0]??{},s=a.rows.map(e=>({evaluationDatasetVersion:String(e.evaluation_dataset_version),modelVersion:String(e.model_version),analysisVersion:String(e.analysis_version),sampleCount:Number(e.sample_count??0),latestCapturedAt:e.latest_captured_at?String(e.latest_captured_at):null,avgPronunciationScore:Number(e.avg_pronunciation_score??0),avgConsonantAccuracy:Number(e.avg_consonant_accuracy??0),avgVowelAccuracy:Number(e.avg_vowel_accuracy??0),avgTrackingQuality:Number(e.avg_tracking_quality??0)})),o=s[0]??null,c=s[1]??null;return{totalCount:Number(i.total_count??0),measuredCount:Number(i.measured_count??0),latestCapturedAt:i.latest_captured_at?String(i.latest_captured_at):null,versions:s,latestVersionComparison:o&&c?{current:o,previous:c,sampleDelta:o.sampleCount-c.sampleCount,pronunciationDelta:o.avgPronunciationScore-c.avgPronunciationScore,consonantDelta:o.avgConsonantAccuracy-c.avgConsonantAccuracy,vowelDelta:o.avgVowelAccuracy-c.avgVowelAccuracy,trackingDelta:o.avgTrackingQuality-c.avgTrackingQuality}:null,modeBreakdown:n.rows.map(e=>({trainingMode:String(e.training_mode),sampleCount:Number(e.sample_count??0)})),qualityBreakdown:r.rows.map(e=>({quality:String(e.quality),sampleCount:Number(e.sample_count??0)}))}}finally{t.release()}}[i,s]=o.then?(await o)():o,e.s(["appendEvaluationSamplesToFile",()=>c,"getEvaluationSamplesSummary",()=>d,"saveEvaluationSamplesToDatabase",()=>u]),a()}catch(e){a(e)}},!1),77483,e=>e.a(async(t,a)=>{try{var n=e.i(89171),r=e.i(23722),i=t([r]);function s(e){return!!(e.historyId&&e.sessionId&&e.patientId&&"measured"===e.quality&&e.transcript.trim().length>0)}async function o(e){let t=await e.json().catch(()=>({})),a=Array.isArray(t.samples)?t.samples.filter(s):[];if(!t.historyId||!t.sessionId||0===a.length)return n.NextResponse.json({ok:!1,error:"invalid_evaluation_sample_payload"},{status:400});try{let e=await (0,r.saveEvaluationSamplesToDatabase)({historyId:t.historyId,sessionId:t.sessionId,samples:a,governance:t.governance??null});return n.NextResponse.json({ok:!0,accepted:e.accepted,storageTarget:e.storageTarget})}catch(i){console.warn("[evaluation-samples] database save failed; falling back to file",i);let e=await (0,r.appendEvaluationSamplesToFile)({historyId:t.historyId,sessionId:t.sessionId,samples:a,governance:t.governance??null});return n.NextResponse.json({ok:!0,accepted:e.accepted,storageTarget:e.storageTarget})}}[r]=i.then?(await i)():i,e.s(["POST",()=>o,"dynamic",0,"force-dynamic","runtime",0,"nodejs"]),a()}catch(e){a(e)}},!1),43810,e=>e.a(async(t,a)=>{try{var n=e.i(47909),r=e.i(74017),i=e.i(96250),s=e.i(59756),o=e.i(61916),l=e.i(74677),c=e.i(69741),u=e.i(16795),d=e.i(87718),p=e.i(95169),_=e.i(47587),m=e.i(66012),y=e.i(70101),g=e.i(26937),v=e.i(10372),E=e.i(93695);e.i(52474);var h=e.i(220),N=e.i(77483),L=t([N]);[N]=L.then?(await L)():L;let C=new n.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/evaluation-samples/route",pathname:"/api/evaluation-samples",filename:"route",bundlePath:""},distDir:".next-sandbox",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/evaluation-samples/route.ts",nextConfigOutput:"",userland:N}),{workAsyncStorage:U,workUnitAsyncStorage:x,serverHooks:w}=C;function D(){return(0,i.patchFetch)({workAsyncStorage:U,workUnitAsyncStorage:x})}async function T(e,t,a){C.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let n="/api/evaluation-samples/route";n=n.replace(/\/index$/,"")||"/";let i=await C.prepare(e,t,{srcPage:n,multiZoneDraftMode:!1});if(!i)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:N,params:L,nextConfig:D,parsedUrl:T,isDraftMode:U,prerenderManifest:x,routerServerContext:w,isOnDemandRevalidate:A,revalidateOnlyGenerated:f,resolvedPathname:O,clientReferenceManifest:R,serverActionsManifest:b}=i,S=(0,c.normalizeAppPath)(n),I=!!(x.dynamicRoutes[S]||x.routes[O]),q=async()=>((null==w?void 0:w.render404)?await w.render404(e,t,T,!1):t.end("This page could not be found"),null);if(I&&!U){let e=!!x.routes[O],t=x.dynamicRoutes[S];if(t&&!1===t.fallback&&!e){if(D.experimental.adapterPath)return await q();throw new E.NoFallbackError}}let $=null;!I||C.isDev||U||($=O,$="/index"===$?"/":$);let P=!0===C.isDev||!I,k=I&&!P;b&&R&&(0,l.setManifestsSingleton)({page:n,clientReferenceManifest:R,serverActionsManifest:b});let X=e.method||"GET",j=(0,o.getTracer)(),F=j.getActiveScopeSpan(),M={params:L,prerenderManifest:x,renderOpts:{experimental:{authInterrupts:!!D.experimental.authInterrupts},cacheComponents:!!D.cacheComponents,supportsDynamicResponse:P,incrementalCache:(0,s.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:D.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,n,r)=>C.onRequestError(e,t,n,r,w)},sharedContext:{buildId:N}},V=new u.NodeNextRequest(e),B=new u.NodeNextResponse(t),H=d.NextRequestAdapter.fromNodeNextRequest(V,(0,d.signalFromNodeResponse)(t));try{let i=async e=>C.handle(H,M).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=j.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let r=a.get("next.route");if(r){let t=`${X} ${r}`;e.setAttributes({"next.route":r,"http.route":r,"next.span_name":t}),e.updateName(t)}else e.updateName(`${X} ${n}`)}),l=!!(0,s.getRequestMeta)(e,"minimalMode"),c=async s=>{var o,c;let u=async({previousCacheEntry:r})=>{try{if(!l&&A&&f&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let n=await i(s);e.fetchMetrics=M.renderOpts.fetchMetrics;let o=M.renderOpts.pendingWaitUntil;o&&a.waitUntil&&(a.waitUntil(o),o=void 0);let c=M.renderOpts.collectedTags;if(!I)return await (0,m.sendResponse)(V,B,n,M.renderOpts.pendingWaitUntil),null;{let e=await n.blob(),t=(0,y.toNodeOutgoingHttpHeaders)(n.headers);c&&(t[v.NEXT_CACHE_TAGS_HEADER]=c),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=v.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,r=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=v.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:h.CachedRouteKind.APP_ROUTE,status:n.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:r}}}}catch(t){throw(null==r?void 0:r.isStale)&&await C.onRequestError(e,t,{routerKind:"App Router",routePath:n,routeType:"route",revalidateReason:(0,_.getRevalidateReason)({isStaticGeneration:k,isOnDemandRevalidate:A})},!1,w),t}},d=await C.handleResponse({req:e,nextConfig:D,cacheKey:$,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:x,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:f,responseGenerator:u,waitUntil:a.waitUntil,isMinimalMode:l});if(!I)return null;if((null==d||null==(o=d.value)?void 0:o.kind)!==h.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(c=d.value)?void 0:c.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});l||t.setHeader("x-nextjs-cache",A?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),U&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let p=(0,y.fromNodeOutgoingHttpHeaders)(d.value.headers);return l&&I||p.delete(v.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||p.get("Cache-Control")||p.set("Cache-Control",(0,g.getCacheControlHeader)(d.cacheControl)),await (0,m.sendResponse)(V,B,new Response(d.value.body,{headers:p,status:d.value.status||200})),null};F?await c(F):await j.withPropagatedContext(e.headers,()=>j.trace(p.BaseServerSpan.handleRequest,{spanName:`${X} ${n}`,kind:o.SpanKind.SERVER,attributes:{"http.method":X,"http.target":e.url}},c))}catch(t){if(t instanceof E.NoFallbackError||await C.onRequestError(e,t,{routerKind:"App Router",routePath:S,routeType:"route",revalidateReason:(0,_.getRevalidateReason)({isStaticGeneration:k,isOnDemandRevalidate:A})},!1,w),I)throw t;return await (0,m.sendResponse)(V,B,new Response(null,{status:500})),null}}e.s(["handler",()=>T,"patchFetch",()=>D,"routeModule",()=>C,"serverHooks",()=>w,"workAsyncStorage",()=>U,"workUnitAsyncStorage",()=>x]),a()}catch(e){a(e)}},!1)];

//# sourceMappingURL=%5Broot-of-the-server%5D__74f03520._.js.map