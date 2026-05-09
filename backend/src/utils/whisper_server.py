import sys
import os
import json
import warnings
from http.server import HTTPServer, BaseHTTPRequestHandler

warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

try:
    import whisper
except ImportError:
    print("Error: openai-whisper library not found.")
    sys.exit(1)

print("Loading Whisper model (base.en)... This takes a few seconds but only happens once!")
model = whisper.load_model("base.en")
print("Model loaded successfully. Whisper server listening on port 5001...")

class WhisperHandler(BaseHTTPRequestHandler):
    # Disable default excessive logging
    def log_message(self, format, *args):
        pass

    def do_POST(self):
        if self.path == '/transcribe':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length)
                req = json.loads(post_data.decode('utf-8'))
                audio_path = req.get('file_path')
                
                if not audio_path or not os.path.exists(audio_path):
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "File not found"}).encode('utf-8'))
                    return
                
                # Transcribe with English-only model to prevent French hallucinations
                result = model.transcribe(
                    audio_path, 
                    fp16=False, 
                    condition_on_previous_text=False
                )
                text = result["text"].strip()
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"text": text}).encode('utf-8'))
            except Exception as e:
                print(f"Server transcription error: {e}")
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Internal error"}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def run(server_class=HTTPServer, handler_class=WhisperHandler, port=5001):
    server_address = ('127.0.0.1', port)
    httpd = server_class(server_address, handler_class)
    httpd.serve_forever()

if __name__ == '__main__':
    run()
