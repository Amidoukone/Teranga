import {
  buildAuthFeedbackState,
  readAuthFeedbackState,
} from "./authFeedback";

describe("authFeedback helpers", () => {
  test("buildAuthFeedbackState normalizes typed route feedback", () => {
    expect(buildAuthFeedbackState(" Signed out ", "SUCCESS")).toEqual({
      feedbackMsg: "Signed out",
      feedbackType: "success",
    });
  });

  test("readAuthFeedbackState supports the standardized feedback shape", () => {
    expect(
      readAuthFeedbackState({
        feedbackMsg: "Reset complete",
        feedbackType: "warning",
      })
    ).toEqual({
      type: "warning",
      message: "Reset complete",
    });
  });

  test("readAuthFeedbackState remains compatible with legacy auth state", () => {
    expect(readAuthFeedbackState({ successMsg: "Welcome back" })).toEqual({
      type: "success",
      message: "Welcome back",
    });
    expect(readAuthFeedbackState({ errorMsg: "Invalid password" })).toEqual({
      type: "error",
      message: "Invalid password",
    });
  });
});
