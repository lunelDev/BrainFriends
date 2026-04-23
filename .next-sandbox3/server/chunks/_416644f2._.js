module.exports=[35930,e=>e.a(async(t,n)=>{try{var s=e.i(63528),i=e.i(77545),a=t([s,i]);function r(e){let t=e.replace(/[^0-9.\-]/g,"").trim();if(!t)return null;let n=Number(t);return Number.isFinite(n)?n:null}function o(e){let t=e.trim();return t.length<=1?`${t}*`:`${t[0]}*${t[t.length-1]}`}async function l(e){let{client:t,patientPseudonymId:n,songKey:s}=e,i=`
    WITH member_best AS (
      SELECT DISTINCT ON (pm.patient_pseudonym_id)
        pm.patient_pseudonym_id,
        pii.full_name,
        sr.score,
        cs.completed_at
      FROM sing_results sr
      JOIN clinical_sessions cs ON cs.session_id = sr.session_id
      JOIN patient_pseudonym_map pm ON pm.patient_pseudonym_id = sr.patient_pseudonym_id
      JOIN patient_pii pii ON pii.patient_id = pm.patient_id
      WHERE cs.training_type = 'sing-training'
        AND sr.song_key = $1
      ORDER BY pm.patient_pseudonym_id, sr.score DESC, cs.completed_at ASC
    ),
    ranked AS (
      SELECT
        patient_pseudonym_id,
        full_name,
        score,
        completed_at,
        ROW_NUMBER() OVER (ORDER BY score DESC, completed_at ASC) AS rank
      FROM member_best
    )
  `,a=`
    WITH member_best AS (
      SELECT DISTINCT ON (pm.patient_pseudonym_id)
        pm.patient_pseudonym_id,
        pii.full_name,
        sr.score,
        cs.completed_at
      FROM sing_results sr
      JOIN clinical_sessions cs ON cs.session_id = sr.session_id
      JOIN patient_pseudonym_map pm ON pm.patient_pseudonym_id = sr.patient_pseudonym_id
      JOIN patient_pii pii ON pii.patient_id = pm.patient_id
      WHERE cs.training_type = 'sing-training'
        AND sr.song_key = $2
      ORDER BY pm.patient_pseudonym_id, sr.score DESC, cs.completed_at ASC
    ),
    ranked AS (
      SELECT
        patient_pseudonym_id,
        full_name,
        score,
        completed_at,
        ROW_NUMBER() OVER (ORDER BY score DESC, completed_at ASC) AS rank
      FROM member_best
    )
  `,[r,l]=await Promise.all([t.query(`${i}
      SELECT patient_pseudonym_id, full_name, score, rank
      FROM ranked
      ORDER BY rank ASC
      LIMIT 5`,[s]),t.query(`${a}
      SELECT patient_pseudonym_id, full_name, score, rank
      FROM ranked
      WHERE patient_pseudonym_id = $1`,[n,s])]);return{top5:r.rows.map(e=>({rank:Number(e.rank),name:o(String(e.full_name)),score:Number(e.score),region:"전국",me:String(e.patient_pseudonym_id)===n})),myRank:l.rows[0]?{rank:Number(l.rows[0].rank),name:o(String(l.rows[0].full_name)),score:Number(l.rows[0].score),region:"전국",me:!0}:null}}async function u(e){let{patient:t,result:n}=e,a=(0,s.getDbPool)(),o=await a.connect(),u=(0,i.buildPatientPseudonymId)(t),d=n.sourceSessionKey?.trim().length?n.sourceSessionKey.trim():`sing-${n.song}-${n.completedAt}`,c=(0,i.deterministicUuid)(`session:${u}:sing:${n.completedAt}:${n.song}`),p=(0,i.deterministicUuid)(`sing-result:${c}`),_=new Date(n.completedAt),g=function(e){let t=e.replace(/[^0-9.]/g,"").trim();if(!t)return null;let n=Number(t);return Number.isFinite(n)?n:null}(n.rtLatency),m=r(n.finalJitter),y=r(n.finalSi),E=r(n.finalConsonant??""),v=r(n.finalVowel??""),h=r(n.lyricAccuracy??"");try{await o.query("BEGIN");let{patientId:e,patientCode:s}=await (0,i.upsertPatientIdentity)(o,t);await o.query(`
        INSERT INTO clinical_sessions (
          session_id,
          patient_pseudonym_id,
          training_type,
          source_session_key,
          started_at,
          completed_at,
          algorithm_version,
          catalog_version,
          release_version,
          status,
          version_snapshot,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW())
        ON CONFLICT (session_id) DO UPDATE
        SET
          source_session_key = EXCLUDED.source_session_key,
          completed_at = EXCLUDED.completed_at,
          algorithm_version = EXCLUDED.algorithm_version,
          catalog_version = EXCLUDED.catalog_version,
          release_version = EXCLUDED.release_version,
          status = EXCLUDED.status,
          version_snapshot = EXCLUDED.version_snapshot
      `,[c,u,"sing-training",d,_,_,n.governance?.analysisVersion??"brain-sing-unknown",n.governance?.catalogVersion??null,n.versionSnapshot?.release_version??null,"completed",n.versionSnapshot?JSON.stringify(n.versionSnapshot):null]),await o.query(`
        INSERT INTO sing_results (
          result_id,
          session_id,
          patient_pseudonym_id,
          song_key,
          score,
          jitter,
          facial_symmetry,
          latency_ms,
          consonant_accuracy,
          vowel_accuracy,
          lyric_accuracy,
          recognized_lyrics,
          comment,
          version_snapshot,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, NOW())
        ON CONFLICT (result_id) DO UPDATE
        SET
          song_key = EXCLUDED.song_key,
          score = EXCLUDED.score,
          jitter = EXCLUDED.jitter,
          facial_symmetry = EXCLUDED.facial_symmetry,
          latency_ms = EXCLUDED.latency_ms,
          consonant_accuracy = EXCLUDED.consonant_accuracy,
          vowel_accuracy = EXCLUDED.vowel_accuracy,
          lyric_accuracy = EXCLUDED.lyric_accuracy,
          recognized_lyrics = EXCLUDED.recognized_lyrics,
          comment = EXCLUDED.comment,
          version_snapshot = EXCLUDED.version_snapshot
      `,[p,c,u,n.song,n.score,m,y,g,E,v,h,n.transcript??null,n.comment,n.versionSnapshot?JSON.stringify(n.versionSnapshot):null]);let a=await l({client:o,patientPseudonymId:u,songKey:n.song});return await o.query("COMMIT"),{patientId:e,patientCode:s,patientPseudonymId:u,sessionId:c,resultId:p,ranking:a}}catch(e){throw await o.query("ROLLBACK"),e}finally{o.release()}}[s,i]=a.then?(await a)():a,e.s(["saveSingResultToDatabase",()=>u]),n()}catch(e){n(e)}},!1),58652,e=>e.a(async(t,n)=>{try{var s=e.i(89171),i=e.i(93458),a=e.i(35930),r=e.i(32476),o=e.i(70080),l=e.i(71106),u=e.i(65093),d=t([a,r,o,l]);async function c(e){var t,n;let d=await e.json().catch(()=>({})),c=await (0,i.cookies)(),p=c.get(r.AUTH_COOKIE_NAME)?.value;if(t=d.patient,!(t?.name?.trim()&&t?.gender&&t?.age))return await (0,o.appendClinicalAuditLog)((0,o.buildSingTrainingAuditLog)({request:e,patient:d.patient??null,status:"rejected",result:d.result?{song:d.result.song,score:Number(d.result.score),finalJitter:d.result.finalJitter,finalSi:d.result.finalSi,rtLatency:d.result.rtLatency,reviewAudioUrl:void 0,versionSnapshot:d.result.versionSnapshot}:null,failureReason:"invalid_patient_payload",storageTargets:["data/audit/clinical-events.ndjson"]})),s.NextResponse.json({ok:!1,error:"invalid_patient_payload"},{status:400});if(n=d.result,!(n?.song&&Number.isFinite(Number(n?.score))&&n?.completedAt))return await (0,o.appendClinicalAuditLog)((0,o.buildSingTrainingAuditLog)({request:e,patient:d.patient,status:"rejected",result:null,failureReason:"invalid_result_payload",storageTargets:["data/audit/clinical-events.ndjson"]})),s.NextResponse.json({ok:!1,error:"invalid_result_payload"},{status:400});if((0,u.isServerPersistenceDisabled)())return await (0,o.appendClinicalAuditLog)((0,o.buildSingTrainingAuditLog)({request:e,patient:d.patient,sessionId:d.patient.sessionId,status:"skipped",result:{song:d.result.song,score:d.result.score,finalJitter:d.result.finalJitter,finalSi:d.result.finalSi,rtLatency:d.result.rtLatency,reviewAudioUrl:void 0,versionSnapshot:d.result.versionSnapshot},failureReason:"vercel_server_persistence_disabled",storageTargets:[]})),s.NextResponse.json({ok:!0,skipped:!0,reason:"vercel_server_persistence_disabled"},{status:200});try{let t=await (0,a.saveSingResultToDatabase)({patient:d.patient,result:d.result});return p&&await (0,l.recordTrainingUsageEvent)(p,{eventType:"sing_result_persisted",trainingType:"sing-training",pagePath:"/result-page/sing-training",sessionId:t.sessionId,payload:{song:d.result.song,score:d.result.score,resultId:t.resultId}}).catch(()=>void 0),await (0,o.appendClinicalAuditLog)((0,o.buildSingTrainingAuditLog)({request:e,patient:d.patient,sessionId:t.sessionId,status:"success",result:{song:d.result.song,score:d.result.score,finalJitter:d.result.finalJitter,finalSi:d.result.finalSi,rtLatency:d.result.rtLatency,reviewAudioUrl:void 0,versionSnapshot:d.result.versionSnapshot},storageTargets:["postgres:patient_pii","postgres:patient_pseudonym_map","postgres:clinical_sessions","postgres:sing_results","data/audit/clinical-events.ndjson"]})),s.NextResponse.json({ok:!0,saved:t,ranking:t.ranking})}catch(t){if(console.error("[sing-results] failed to persist",t),t?.message==="missing_database_url")return await (0,o.appendClinicalAuditLog)((0,o.buildSingTrainingAuditLog)({request:e,patient:d.patient,sessionId:d.patient.sessionId,status:"skipped",result:{song:d.result.song,score:d.result.score,finalJitter:d.result.finalJitter,finalSi:d.result.finalSi,rtLatency:d.result.rtLatency,reviewAudioUrl:void 0,versionSnapshot:d.result.versionSnapshot},failureReason:"missing_database_url",storageTargets:["data/audit/clinical-events.ndjson"]})),s.NextResponse.json({ok:!0,skipped:!0,reason:"missing_database_url"},{status:200});return await (0,o.appendClinicalAuditLog)((0,o.buildSingTrainingAuditLog)({request:e,patient:d.patient,sessionId:d.patient.sessionId,status:"failed",result:{song:d.result.song,score:d.result.score,finalJitter:d.result.finalJitter,finalSi:d.result.finalSi,rtLatency:d.result.rtLatency,reviewAudioUrl:void 0,versionSnapshot:d.result.versionSnapshot},failureReason:t?.message||"failed_to_persist_sing_result",storageTargets:["data/audit/clinical-events.ndjson"]})),s.NextResponse.json({ok:!1,error:t?.message||"failed_to_persist_sing_result"},{status:500})}}[a,r,o,l]=d.then?(await d)():d,e.s(["POST",()=>c,"dynamic",0,"force-dynamic","runtime",0,"nodejs"]),n()}catch(e){n(e)}},!1),6408,e=>e.a(async(t,n)=>{try{var s=e.i(47909),i=e.i(74017),a=e.i(96250),r=e.i(59756),o=e.i(61916),l=e.i(74677),u=e.i(69741),d=e.i(16795),c=e.i(87718),p=e.i(95169),_=e.i(47587),g=e.i(66012),m=e.i(70101),y=e.i(26937),E=e.i(10372),v=e.i(93695);e.i(52474);var h=e.i(220),f=e.i(58652),R=t([f]);[f]=R.then?(await R)():R;let w=new s.AppRouteRouteModule({definition:{kind:i.RouteKind.APP_ROUTE,page:"/api/sing-results/route",pathname:"/api/sing-results",filename:"route",bundlePath:""},distDir:".next-sandbox3",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/sing-results/route.ts",nextConfigOutput:"",userland:f}),{workAsyncStorage:N,workUnitAsyncStorage:A,serverHooks:D}=w;function S(){return(0,a.patchFetch)({workAsyncStorage:N,workUnitAsyncStorage:A})}async function C(e,t,n){w.isDev&&(0,r.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let s="/api/sing-results/route";s=s.replace(/\/index$/,"")||"/";let a=await w.prepare(e,t,{srcPage:s,multiZoneDraftMode:!1});if(!a)return t.statusCode=400,t.end("Bad Request"),null==n.waitUntil||n.waitUntil.call(n,Promise.resolve()),null;let{buildId:f,params:R,nextConfig:S,parsedUrl:C,isDraftMode:N,prerenderManifest:A,routerServerContext:D,isOnDemandRevalidate:O,revalidateOnlyGenerated:T,resolvedPathname:b,clientReferenceManifest:L,serverActionsManifest:I}=a,k=(0,u.normalizeAppPath)(s),U=!!(A.dynamicRoutes[k]||A.routes[b]),$=async()=>((null==D?void 0:D.render404)?await D.render404(e,t,C,!1):t.end("This page could not be found"),null);if(U&&!N){let e=!!A.routes[b],t=A.dynamicRoutes[k];if(t&&!1===t.fallback&&!e){if(S.experimental.adapterPath)return await $();throw new v.NoFallbackError}}let x=null;!U||w.isDev||N||(x=b,x="/index"===x?"/":x);let P=!0===w.isDev||!U,j=U&&!P;I&&L&&(0,l.setManifestsSingleton)({page:s,clientReferenceManifest:L,serverActionsManifest:I});let q=e.method||"GET",M=(0,o.getTracer)(),H=M.getActiveScopeSpan(),X={params:R,prerenderManifest:A,renderOpts:{experimental:{authInterrupts:!!S.experimental.authInterrupts},cacheComponents:!!S.cacheComponents,supportsDynamicResponse:P,incrementalCache:(0,r.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:S.cacheLife,waitUntil:n.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,n,s,i)=>w.onRequestError(e,t,s,i,D)},sharedContext:{buildId:f}},F=new d.NodeNextRequest(e),J=new d.NodeNextResponse(t),B=c.NextRequestAdapter.fromNodeNextRequest(F,(0,c.signalFromNodeResponse)(t));try{let a=async e=>w.handle(B,X).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let n=M.getRootSpanAttributes();if(!n)return;if(n.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${n.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let i=n.get("next.route");if(i){let t=`${q} ${i}`;e.setAttributes({"next.route":i,"http.route":i,"next.span_name":t}),e.updateName(t)}else e.updateName(`${q} ${s}`)}),l=!!(0,r.getRequestMeta)(e,"minimalMode"),u=async r=>{var o,u;let d=async({previousCacheEntry:i})=>{try{if(!l&&O&&T&&!i)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let s=await a(r);e.fetchMetrics=X.renderOpts.fetchMetrics;let o=X.renderOpts.pendingWaitUntil;o&&n.waitUntil&&(n.waitUntil(o),o=void 0);let u=X.renderOpts.collectedTags;if(!U)return await (0,g.sendResponse)(F,J,s,X.renderOpts.pendingWaitUntil),null;{let e=await s.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(s.headers);u&&(t[E.NEXT_CACHE_TAGS_HEADER]=u),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let n=void 0!==X.renderOpts.collectedRevalidate&&!(X.renderOpts.collectedRevalidate>=E.INFINITE_CACHE)&&X.renderOpts.collectedRevalidate,i=void 0===X.renderOpts.collectedExpire||X.renderOpts.collectedExpire>=E.INFINITE_CACHE?void 0:X.renderOpts.collectedExpire;return{value:{kind:h.CachedRouteKind.APP_ROUTE,status:s.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:n,expire:i}}}}catch(t){throw(null==i?void 0:i.isStale)&&await w.onRequestError(e,t,{routerKind:"App Router",routePath:s,routeType:"route",revalidateReason:(0,_.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:O})},!1,D),t}},c=await w.handleResponse({req:e,nextConfig:S,cacheKey:x,routeKind:i.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:A,isRoutePPREnabled:!1,isOnDemandRevalidate:O,revalidateOnlyGenerated:T,responseGenerator:d,waitUntil:n.waitUntil,isMinimalMode:l});if(!U)return null;if((null==c||null==(o=c.value)?void 0:o.kind)!==h.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==c||null==(u=c.value)?void 0:u.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});l||t.setHeader("x-nextjs-cache",O?"REVALIDATED":c.isMiss?"MISS":c.isStale?"STALE":"HIT"),N&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let p=(0,m.fromNodeOutgoingHttpHeaders)(c.value.headers);return l&&U||p.delete(E.NEXT_CACHE_TAGS_HEADER),!c.cacheControl||t.getHeader("Cache-Control")||p.get("Cache-Control")||p.set("Cache-Control",(0,y.getCacheControlHeader)(c.cacheControl)),await (0,g.sendResponse)(F,J,new Response(c.value.body,{headers:p,status:c.value.status||200})),null};H?await u(H):await M.withPropagatedContext(e.headers,()=>M.trace(p.BaseServerSpan.handleRequest,{spanName:`${q} ${s}`,kind:o.SpanKind.SERVER,attributes:{"http.method":q,"http.target":e.url}},u))}catch(t){if(t instanceof v.NoFallbackError||await w.onRequestError(e,t,{routerKind:"App Router",routePath:k,routeType:"route",revalidateReason:(0,_.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:O})},!1,D),U)throw t;return await (0,g.sendResponse)(F,J,new Response(null,{status:500})),null}}e.s(["handler",()=>C,"patchFetch",()=>S,"routeModule",()=>w,"serverHooks",()=>D,"workAsyncStorage",()=>N,"workUnitAsyncStorage",()=>A]),n()}catch(e){n(e)}},!1)];

//# sourceMappingURL=_416644f2._.js.map