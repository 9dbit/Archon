# Isolated, opt-in ARCHON export runner. Never used by the web/APS services.
FROM postgres:18-bookworm
RUN apt-get update \
 && apt-get install -y --no-install-recommends bash age awscli openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/archon-backup
COPY ops/backup/*.sh ./
RUN chmod 0555 ./*.sh
USER postgres
ENTRYPOINT ["/opt/archon-backup/export.sh"]
