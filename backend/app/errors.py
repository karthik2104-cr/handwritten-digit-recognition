"""Application errors that map to safe HTTP responses."""


class AppError(Exception):
    """Expected failure with a client-facing message and status code."""

    def __init__(self, message: str, code: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


class BlankCanvasError(AppError):
    """Raised when an image does not contain a drawable digit."""

    def __init__(self) -> None:
        super().__init__(
            "No digit was detected. Draw a digit before predicting.",
            "blank_canvas",
            400,
        )


class ModelUnavailableError(AppError):
    """Raised when a prediction is requested before a model is available."""

    def __init__(self, message: str) -> None:
        super().__init__(message, "model_unavailable", 503)
