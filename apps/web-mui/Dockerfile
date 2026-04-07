FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/web-mui/package.json apps/web-mui/package.json
RUN npm install

COPY . .

EXPOSE 5173
CMD ["npm", "--workspace", "apps/web-mui", "run", "start"]
