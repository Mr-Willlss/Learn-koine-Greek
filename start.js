document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startBtn");
  if (!startBtn) return;
  startBtn.addEventListener("click", () => {
    window.location.href = "dashboard.html";
  });
});
