# Vite SPA → static files served by nginx on port 8080 (Cloud Run).
# Supabase keys are baked at build time (same as Vercel); use GitHub Actions secrets.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_DEFAULT_APP_EMAIL
ARG VITE_STRIPE_SUBSCRIPTION_CHECKOUT_URL

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_DEFAULT_APP_EMAIL=$VITE_DEFAULT_APP_EMAIL
ENV VITE_STRIPE_SUBSCRIPTION_CHECKOUT_URL=$VITE_STRIPE_SUBSCRIPTION_CHECKOUT_URL

RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
