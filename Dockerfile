# syntax=docker/dockerfile:1
#
# صورة إنتاج لتطبيق «مصاريفي» — VPS أو أي منصة بتشغّل Docker.
#
# نقاط مهمة:
#  · الـmigrations بتشتغل **تلقائيًا** عند الإقلاع (src/instrumentation.ts)،
#    عشان كده مجلد `drizzle/` لازم يكون جوه الصورة.
#  · قاعدة البيانات الافتراضية ملف في `/app/data` — اربطه بـvolume عشان يفضل بعد إعادة الإنشاء.
#  · لو هتستخدم Turso/قاعدة سحابية، مرّر `DATABASE_URL` و`DATABASE_AUTH_TOKEN`
#    وساعتها الـvolume مش ضروري.
#  · **مهم للنشر العام:** حطّ `APP_ACCESS_CODE` عشان تفعّل بوابة كلمة السر
#    (التطبيق مفيهوش تسجيل دخول).

###### 1) مرحلة البناء ######
FROM node:22-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# التبعيات الأول عشان الطبقة تتخزّن (cache) ما دامت package-lock ما اتغيّرتش
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


###### 2) مرحلة التشغيل ######
FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:./data/masareefy.db

# تبعيات الإنتاج فقط (أصغر بكتير من مرحلة البناء)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ما يلزم للتشغيل فقط: البناء + الملفات العامة + الـmigrations + الإعدادات
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# مجلد البيانات + تشغيل بمستخدم غير root
RUN mkdir -p /app/data && chown -R node:node /app
USER node
VOLUME ["/app/data"]

EXPOSE 3000

# فحص صحة بـfetch المدمج في Node (مفيش curl/wget في صورة slim)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(function(r){process.exit(r.ok?0:1)}).catch(function(){process.exit(1)})"

CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
