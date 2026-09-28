FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    asterisk \
    asterisk-modules \
    asterisk-core-sounds-en-wav \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /usr/share/asterisk/sounds/custom /var/spool/asterisk/recording \
    && chown asterisk:asterisk /var/spool/asterisk/recording

COPY etc/pjsip.conf /etc/asterisk/pjsip.conf
COPY etc/extensions.conf /etc/asterisk/extensions.conf
COPY etc/ari.conf /etc/asterisk/ari.conf
COPY etc/http.conf /etc/asterisk/http.conf
COPY etc/rtp.conf /etc/asterisk/rtp.conf

EXPOSE 5060/udp 8088/tcp 10000-10200/udp

# EXTERNAL_MEDIA_ADDRESS = the Docker host's real IP (see README), so Asterisk advertises
# a reachable address in SDP instead of its own internal container IP.
CMD sh -c 'sed -i "s/YOUR_HOST_IP/${EXTERNAL_MEDIA_ADDRESS:-127.0.0.1}/g" /etc/asterisk/pjsip.conf && exec asterisk -f -vvv'
