import sys
import os
import io
import warnings

# Suppress annoying warning from whisper loading process
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)
try:
    import whisper
except ImportError:
    print("Error: openai-whisper library not found. Please install it using `pip install openai-whisper`")
    sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print("Usage: python whisper_transcription.py <path_to_audio_file>")
        sys.exit(1)
        
    audio_path = sys.argv[1]
    
    if not os.path.exists(audio_path):
        print(f"Error: File not found at {audio_path}")
        sys.exit(1)

    try:
        # Load the base model.
        # This will download the model to ~/.cache/whisper on first run.
        model = whisper.load_model("base")
        
        # Transcribe
        # Use fp16=False for CPU compatibility if a GPU is unavailable
        result = model.transcribe(audio_path, fp16=False)
        
        # Print ONLY the transcribed text. Do not add any debug or extraneous statements like "Transcription Start".
        # Node child_process captures stdout.
        text = result["text"].strip()
        print(text)
        
    except Exception as e:
        print(f"An error occurred during transcription: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
