module.exports=[23862,a=>a.a(async(b,c)=>{try{let b=await a.y("pg-587764f78a6c7a9c");a.n(b),c()}catch(a){c(a)}},!0),66680,(a,b,c)=>{b.exports=a.x("node:crypto",()=>require("node:crypto"))},24868,(a,b,c)=>{b.exports=a.x("fs/promises",()=>require("fs/promises"))},54799,(a,b,c)=>{b.exports=a.x("crypto",()=>require("crypto"))},12714,(a,b,c)=>{b.exports=a.x("node:fs/promises",()=>require("node:fs/promises"))},50227,(a,b,c)=>{b.exports=a.x("node:path",()=>require("node:path"))},27788,a=>a.a(async(b,c)=>{try{var d=a.i(23862),e=b([d]);[d]=e.then?(await e)():e;let g=process.env.DATABASE_URL;function f(){if(!g)throw Error("missing_database_url");return global.__brainfriendsPgPool||(global.__brainfriendsPgPool=new d.Pool({connectionString:g,ssl:"require"===process.env.DATABASE_SSL&&{rejectUnauthorized:!1}})),global.__brainfriendsPgPool}g||console.warn("[db] DATABASE_URL is not configured. Database writes are disabled."),a.s(["getDbPool",()=>f]),c()}catch(a){c(a)}},!1),60909,a=>a.a(async(b,c)=>{try{a.i(54799);var d=a.i(27788),e=b([d]);[d]=e.then?(await e)():e,a.s([]),c()}catch(a){c(a)}},!1),62976,a=>{a.v({className:"noto_sans_kr_2dbd30d7-module__1K_nbq__className",variable:"noto_sans_kr_2dbd30d7-module__1K_nbq__variable"})},52648,a=>{"use strict";var b=a.i(62976);let c={className:b.default.className,style:{fontFamily:"'Noto Sans KR', 'Noto Sans KR Fallback'",fontStyle:"normal"}};null!=b.default.variable&&(c.variable=b.default.variable),a.s(["default",0,c])},7522,a=>a.a(async(b,c)=>{try{var d=a.i(40003),e=a.i(27788),f=b([d,e]);[d,e]=f.then?(await f)():f;let j=null;async function g(){j||(j=(async()=>{let a=(0,e.getDbPool)();await a.query(`
        CREATE TABLE IF NOT EXISTS training_client_drafts (
          user_id UUID NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
          storage_scope VARCHAR(10) NOT NULL,
          draft_key VARCHAR(200) NOT NULL,
          draft_value TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, storage_scope, draft_key)
        )
      `)})().catch(a=>{throw j=null,a})),await j}async function h(a){let b=await (0,d.getAuthenticatedSessionContext)(a);if(!b)throw Error("unauthorized");return await g(),b}async function i(a){let b=await h(a),c=(0,e.getDbPool)(),d=await c.query(`
      SELECT storage_scope, draft_key, draft_value
      FROM training_client_drafts
      WHERE user_id = $1
    `,[b.userId]),f={local:{},session:{}};for(let a of d.rows)f["session"===String(a.storage_scope)?"session":"local"][String(a.draft_key)]=String(a.draft_value);return f}a.s(["listTrainingDraftsForAuthenticatedUser",()=>i]),c()}catch(a){c(a)}},!1),13450,a=>{"use strict";let b=["btt.trainingMode","brain-sing-last-song","ui.theme","ui.lastPlace","session.progress.currentStep","session.progress.place","kwab_training_exit_progress"],c=["btt.sessionId","btt.trialMode","session.progress.currentStep","session.progress.place","session.temp.uiNotice","brain-sing-result","security.blockedWriteCount"],d=new Set(b),e=new Set(c),f=[...b],g=[...c],h=["kwab_training_session:","kwab_training_history:"],i=["step3_protocol:","step6_questions:","step_review:"];function j(a){let b={local:{},session:{}};for(let c of["local","session"])for(let[f,g]of Object.entries(a?.[c]??{}))"string"==typeof g&&function(a,b){return!!b&&("local"===a?d.has(b)||h.some(a=>b.startsWith(a)):e.has(b)||i.some(a=>b.startsWith(a)))}(c,f)&&(b[c][f]=g);return b}a.s(["LOCAL_MANAGED_KEYS",0,f,"LOCAL_MANAGED_PREFIXES",0,h,"SESSION_MANAGED_KEYS",0,g,"SESSION_MANAGED_PREFIXES",0,i,"filterManagedStorageDrafts",()=>j],13450)},18936,a=>{"use strict";function b(a){return{patientId:String(a?.id??""),role:a?.userRole==="admin"?"admin":a?.userRole==="therapist"?"therapist":"patient",displayName:String(a?.name??"사용자")}}a.s(["redactPatientForClient",()=>b])},27572,a=>a.a(async(b,c)=>{try{var d=a.i(7997),e=a.i(5246),f=a.i(52648),g=a.i(40003),h=a.i(7522),i=a.i(13450),j=a.i(18936),k=b([g,h]);async function l({children:a}){let b,c,k,l,m,n,o=await (0,e.cookies)(),p=o.get(g.AUTH_COOKIE_NAME)?.value,q=p?await (0,g.getAuthenticatedSessionContext)(p).catch(()=>null):null,r=q?.patient??null,s=(0,j.redactPatientForClient)(r),t=(0,i.filterManagedStorageDrafts)(p?await (0,h.listTrainingDraftsForAuthenticatedUser)(p).catch(()=>({local:{},session:{}})):{local:{},session:{}});return(0,d.jsxs)("html",{lang:"ko",suppressHydrationWarning:!0,children:[(0,d.jsx)("head",{}),(0,d.jsxs)("body",{suppressHydrationWarning:!0,className:`${f.default.variable} antialiased`,children:[(0,d.jsx)("script",{dangerouslySetInnerHTML:{__html:(b=JSON.stringify(s??null).replace(/</g,"\\u003c"),c=JSON.stringify(t??{local:{},session:{}}).replace(/</g,"\\u003c"),k=JSON.stringify(i.LOCAL_MANAGED_KEYS),l=JSON.stringify(i.LOCAL_MANAGED_PREFIXES),m=JSON.stringify(i.SESSION_MANAGED_KEYS),n=JSON.stringify(i.SESSION_MANAGED_PREFIXES),`
    (() => {
      const patient = ${b};
      const drafts = ${c};
      const localManagedKeys = new Set(${k});
      const localManagedPrefixes = ${l};
      const sessionManagedKeys = new Set(${m});
      const sessionManagedPrefixes = ${n};
      window.__BRAINFRIENDS_PATIENT__ = patient;
      window.__BRAINFRIENDS_DRAFTS__ = drafts;

      const isManagedKey = (scope, key) => {
        if (!key) return false;
        if (scope === "local") {
          return localManagedKeys.has(key) || localManagedPrefixes.some((prefix) => key.startsWith(prefix));
        }
        if (sessionManagedKeys.has(key)) {
          return true;
        }
        return sessionManagedPrefixes.some((prefix) => key.startsWith(prefix));
      };

      const hydrateStorage = (scope, storage, values) => {
        if (!storage) return;
        const existingKeys = [];
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (key) existingKeys.push(key);
        }
        for (const key of existingKeys) {
          if (isManagedKey(scope, key) && !(key in values)) {
            storage.removeItem(key);
          }
        }
        Object.entries(values || {}).forEach(([key, value]) => {
          if (typeof value === "string") {
            storage.setItem(key, value);
          }
        });
      };

      try {
        hydrateStorage("local", window.localStorage, drafts?.local || {});
        hydrateStorage("session", window.sessionStorage, drafts?.session || {});
      } catch {}

      if (window.__BRAINFRIENDS_STORAGE_SYNC__) {
        return;
      }
      window.__BRAINFRIENDS_STORAGE_SYNC__ = true;

      const rawSetItem = Storage.prototype.setItem;
      const rawRemoveItem = Storage.prototype.removeItem;
      const sync = (scope, key, value, method) => {
        if (!isManagedKey(scope, key)) return;
        const body =
          method === "PUT"
            ? JSON.stringify({ scope, key, value })
            : JSON.stringify({ scope, key });
        fetch("/api/client-storage-sync", {
          method,
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => undefined);
      };

      Storage.prototype.setItem = function(key, value) {
        rawSetItem.call(this, key, value);
        if (this === window.localStorage) {
          sync("local", String(key), String(value), "PUT");
          return;
        }
        if (this === window.sessionStorage) {
          sync("session", String(key), String(value), "PUT");
        }
      };

      Storage.prototype.removeItem = function(key) {
        rawRemoveItem.call(this, key);
        if (this === window.localStorage) {
          sync("local", String(key), "", "DELETE");
          return;
        }
        if (this === window.sessionStorage) {
          sync("session", String(key), "", "DELETE");
        }
      };
    })();
  `)}}),a]})]})}[g,h]=k.then?(await k)():k,a.s(["default",()=>l,"metadata",0,{title:"브레인프렌즈",description:"SaMD 기반 언어 재활 훈련"}]),c()}catch(a){c(a)}},!1)];

//# sourceMappingURL=%5Broot-of-the-server%5D__ca19f1a8._.js.map