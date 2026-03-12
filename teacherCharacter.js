// Animated teacher helper.
const teacher = {
  element: null,
  mood: "idle"
};

function initTeacher() {
  teacher.element = document.getElementById("teacher");
  setTeacherMood("idle");
}

function setTeacherMood(mood) {
  teacher.mood = mood;
  if (!teacher.element) {
    return;
  }
  teacher.element.dataset.mood = mood;
  teacher.element.style.filter = mood === "sad" ? "grayscale(0.5)" : "none";
}

function teacherSpeak(message) {
  toast(message);
}

initTeacher();
