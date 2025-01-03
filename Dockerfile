FROM ubuntu:latest

RUN apt-get update

RUN apt-get install -y nodejs

EXPOSE 9000

CMD ["bash", "/app/run-ddgpt"]
