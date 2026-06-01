# Stage 1: Build Vue.js app
FROM node:22-alpine AS build-stage

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

COPY frontend/ ./
ENV DOCKER_BUILD=true
RUN npm run build

# Stage 2: Set up Flask environment
FROM continuumio/miniconda3 AS final-stage

RUN conda install -y -c conda-forge r-base && conda clean -afy

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN python3 -c "\
raw = open('backend/requirements.txt','rb').read(); \
text = raw.decode('utf-16') if raw[:2] in (b'\xff\xfe', b'\xfe\xff') else raw.replace(b'\x00',b'').decode('utf-8','ignore'); \
open('/tmp/req.txt','w').write(text)" \
  && pip install -r /tmp/req.txt

COPY backend/ ./backend/

RUN mkdir -p /app/files /app/backend/files

# Copy built frontend from stage 1
COPY --from=build-stage /app/frontend/dist ./frontend/dist

ENV FLASK_APP=backend/app.py

EXPOSE 5000

CMD ["flask", "run", "--host=0.0.0.0"]
