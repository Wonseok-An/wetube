const form = document.getElementById("commentForm");
const videoContainer = document.getElementById("videoContainer");

const addComment = (text) => {
    const videoComments = document.querySelector(".video__comments ul");
    const newComment = document.createElement("li");
    newComment.className = "video__comment"
    newComment.innerText = text;
    videoComments.prepend(newComment);
}

const handleSubmit = async (event) => {
    event.preventDefault();
    const textarea = form.querySelector("textarea");

    const text = textarea.value;
    const videoId = videoContainer.dataset.video_id;

    if (text === "") {
        return;
    }

    const response = await fetch(`/api/videos/${videoId}/comment`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
    });

    textarea.value = "";

    const json = await response.json();


    if (response.status === 201) {
        addComment(text);
    }
}

if (form) {
    form.addEventListener("submit", handleSubmit);
}


