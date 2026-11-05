#!/bin/bash
# Prepare the AIRI-only Unix socket account. Keep the investment account intact.
set -euo pipefail
test "$(id -u)" = 0 || { echo 'Run as root' >&2; exit 1; }
key_file=${1:?Pass the uploaded desktop public key file}
ssh-keygen -lf "$key_file" >/dev/null
key=$(cat "$key_file")
[[ "$key" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ .*)?$ ]] || exit 1
relay_user=airi-relay
relay_home=/var/lib/airi-relay
runtime=/srv/304aistudio/airi-relay
if ! id "$relay_user" >/dev/null 2>&1; then
    useradd --system --create-home --home-dir "$relay_home" --shell /usr/sbin/nologin "$relay_user"
fi
test "$(getent passwd "$relay_user" | cut -d: -f6)" = "$relay_home"
install -d -m 0700 -o "$relay_user" -g "$relay_user" "$relay_home/.ssh"
install -d -m 0755 -o "$relay_user" -g "$relay_user" "$runtime"
authorized="$relay_home/.ssh/authorized_keys"
touch "$authorized"
if ! grep -Fq "$key" "$authorized"; then
    printf 'restrict,port-forwarding,command="/usr/sbin/nologin" %s\n' "$key" >> "$authorized"
fi
chown "$relay_user:$relay_user" "$authorized"
chmod 0600 "$authorized"
config=/etc/ssh/sshd_config
if ! grep -q '^# BEGIN 304 AIRI RELAY$' "$config"; then
    backup="$config.before-airi-$(date +%Y%m%dT%H%M%S)"
    cp -p "$config" "$backup"
    cat >> "$config" <<'CONFIG'

# BEGIN 304 AIRI RELAY
Match User airi-relay
    AuthenticationMethods publickey
    PasswordAuthentication no
    AllowTcpForwarding remote
    PermitListen none
    AllowStreamLocalForwarding remote
    StreamLocalBindMask 0111
    StreamLocalBindUnlink yes
    X11Forwarding no
    AllowAgentForwarding no
    PermitTTY no
    ForceCommand /usr/sbin/nologin
Match all
# END 304 AIRI RELAY
CONFIG
    if ! sshd -t; then cp -p "$backup" "$config"; exit 1; fi
fi
effective=$(sshd -T -C user="$relay_user",host=localhost,addr=127.0.0.1)
grep -qx 'allowtcpforwarding remote' <<< "$effective"
grep -qx 'permitlisten none' <<< "$effective"
grep -qx 'allowstreamlocalforwarding remote' <<< "$effective"
grep -qx 'forcecommand /usr/sbin/nologin' <<< "$effective"
systemctl reload sshd
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
printf 'AIRI-only desktop relay prepared. No application TCP port was opened.\n'
