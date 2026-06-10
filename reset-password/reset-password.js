(function () {
  const statusEl = document.getElementById("reset-status");
  const formEl = document.getElementById("reset-password-form");
  const passwordEl = document.getElementById("new-password");
  const confirmPasswordEl = document.getElementById("confirm-password");

  function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
  }

  function getConfig() {
    const config = window.MORBIT_SUPABASE_CONFIG || {};
    const isPlaceholder =
      !config.url ||
      !config.anonKey ||
      config.url.includes("YOUR_PROJECT_ID") ||
      config.anonKey.includes("YOUR_SUPABASE_ANON_KEY");

    return { ...config, isPlaceholder };
  }

  function hasRecoveryToken() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);

    return (
      hash.get("type") === "recovery" ||
      hash.has("access_token") ||
      query.get("type") === "recovery" ||
      query.has("code")
    );
  }

  async function restoreRecoverySession(client) {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const code = query.get("code");

    if (accessToken && refreshToken) {
      const { error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (error) throw error;
      return;
    }

    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return;
    }

    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      throw new Error("비밀번호 재설정 세션을 찾을 수 없습니다.");
    }
  }

  async function init() {
    const config = getConfig();

    if (config.isPlaceholder) {
      setStatus(
        "Supabase 설정이 아직 연결되지 않았습니다. reset-password/config.js에 프로젝트 URL과 anon key를 입력해주세요.",
        "error"
      );
      return;
    }

    if (!window.supabase || !window.supabase.createClient) {
      setStatus("Supabase 라이브러리를 불러오지 못했습니다. 네트워크 연결을 확인해주세요.", "error");
      return;
    }

    const client = window.supabase.createClient(config.url, config.anonKey);

    if (!hasRecoveryToken()) {
      setStatus(
        "비밀번호 재설정 메일의 링크로 접속해야 새 비밀번호를 설정할 수 있습니다.",
        "error"
      );
      return;
    }

    try {
      await restoreRecoverySession(client);
      setStatus("새 비밀번호를 입력해주세요.", "success");
      formEl.hidden = false;
    } catch (error) {
      setStatus(error.message || "비밀번호 재설정 링크를 확인하지 못했습니다.", "error");
      return;
    }

    formEl.addEventListener("submit", async (event) => {
      event.preventDefault();

      const password = passwordEl.value.trim();
      const confirmPassword = confirmPasswordEl.value.trim();

      if (password.length < 8) {
        setStatus("새 비밀번호는 8자 이상이어야 합니다.", "error");
        return;
      }

      if (password !== confirmPassword) {
        setStatus("새 비밀번호와 확인 비밀번호가 일치하지 않습니다.", "error");
        return;
      }

      formEl.querySelector("button").disabled = true;
      setStatus("비밀번호를 변경하는 중입니다.", "info");

      const { error } = await client.auth.updateUser({ password });

      if (error) {
        formEl.querySelector("button").disabled = false;
        setStatus(error.message || "비밀번호 변경에 실패했습니다.", "error");
        return;
      }

      await client.auth.signOut();
      formEl.hidden = true;
      setStatus("비밀번호가 변경되었습니다. 이제 버스비서 앱에서 새 비밀번호로 로그인해주세요.", "success");
    });
  }

  window.addEventListener("DOMContentLoaded", init);
})();
