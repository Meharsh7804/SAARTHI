import axios from "axios";

const submitFeedback = async (feedbackData) => {
  const token = localStorage.getItem("token");
  try {
    const response = await axios.post(
      `${import.meta.env.VITE_SERVER_URL}/feedback/submit`,
      feedbackData,
      {
        headers: {
          token: token,
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : new Error("Feedback submission failed");
  }
};

export default {
  submitFeedback,
};
