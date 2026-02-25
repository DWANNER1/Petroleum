FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install

COPY . .

EXPOSE 5173
CMD ["npm", "--workspace", "apps/web", "run", "start"]
