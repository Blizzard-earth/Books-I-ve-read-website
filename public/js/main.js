// Front-end JavaScript for My Diary

// If a cover image fails to load, hide it and show the brown placeholder instead.
// (This is defined at the top level because the <img onerror="..."> attributes call it.)
function coverFailed(img) {
  img.style.display = "none";
  const placeholder = img.parentElement.querySelector(".cover-placeholder");
  if (placeholder) placeholder.style.display = "flex";
}

document.addEventListener("DOMContentLoaded", () => {
  // Ask "Are you sure?" before submitting any form that has data-confirm (used by Delete).
  document.querySelectorAll("form[data-confirm]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (!confirm(form.dataset.confirm)) event.preventDefault();
    });
  });

  // On the Add page: clicking "Use this book" copies the search result into the form.
  document.querySelectorAll(".use-book").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("title").value = button.dataset.title;
      document.getElementById("author").value = button.dataset.author;
      document.getElementById("first_publish_year").value = button.dataset.year;
      document.getElementById("cover_id").value = button.dataset.coverId;
      document.getElementById("isbn").value = button.dataset.isbn;

      // Scroll down to the form so the user can add rating and notes.
      document.getElementById("rating").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
});
