import sys
import argparse


class BartSummarizer:
    def __init__(self):
        self._model = None
        self._tokenizer = None

    def _load_model(self):
        if self._model is None or self._tokenizer is None:
            from transformers import BartForConditionalGeneration, BartTokenizer
            import torch

            device = "cpu"
            model_name = "facebook/bart-large-cnn"

            self._tokenizer = BartTokenizer.from_pretrained(model_name)
            self._model = BartForConditionalGeneration.from_pretrained(model_name).to(device)

    def summarize(self, text, max_length=150):
        self._load_model()

        import torch

        inputs = self._tokenizer(
            text,
            max_length=1024,
            truncation=True,
            return_tensors="pt"
        ).to("cpu")

        summary_ids = self._model.generate(
            inputs["input_ids"],
            max_length=max_length,
            min_length=30,
            length_penalty=2.0,
            num_beams=4,
            early_stopping=True
        )

        summary = self._tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        return summary


def read_input(file_path=None):
    if file_path:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    else:
        return sys.stdin.read()


def main():
    parser = argparse.ArgumentParser(
        description="Text summarization using BART model"
    )
    parser.add_argument(
        "file",
        nargs="?",
        help="Input text file (if not provided, reads from stdin)"
    )
    parser.add_argument(
        "--max-length",
        type=int,
        default=150,
        help="Maximum summary length (default: 150)"
    )

    args = parser.parse_args()

    text = read_input(args.file)

    if not text.strip():
        print("Error: Empty input", file=sys.stderr)
        sys.exit(1)

    summarizer = BartSummarizer()
    summary = summarizer.summarize(text, max_length=args.max_length)
    print(summary)


if __name__ == "__main__":
    main()
