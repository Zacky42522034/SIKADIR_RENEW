import time
import requests
import psycopg2

TELEGRAM_BOT_TOKEN = "8650236021:AAFdpceCmZmVOUC5cSeIasyK91PN1nj_U1I"
BASE_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"
DB_URL = "postgresql://postgres:postgres@127.0.0.1:54332/postgres"

def update_db_status(leave_id, new_status):
    try:
        conn = psycopg2.connect(DB_URL)
        cursor = conn.cursor()
        cursor.execute("UPDATE leave_requests SET status = %s WHERE id = %s", (new_status, leave_id))
        conn.commit()
        cursor.close()
        conn.close()
        print(f"Updated leave_id {leave_id} to {new_status}")
        return True
    except Exception as e:
        print("DB Update Error:", e)
        return False

def answer_callback(callback_id, text):
    requests.post(f"{BASE_URL}/answerCallbackQuery", json={
        "callback_query_id": callback_id,
        "text": text
    })

def edit_message(chat_id, message_id, new_text):
    requests.post(f"{BASE_URL}/editMessageCaption", json={
        "chat_id": chat_id,
        "message_id": message_id,
        "caption": new_text,
        "parse_mode": "Markdown",
        "reply_markup": {"inline_keyboard": []}
    })
    # Fallback if it was a text message (no photo)
    requests.post(f"{BASE_URL}/editMessageText", json={
        "chat_id": chat_id,
        "message_id": message_id,
        "text": new_text,
        "parse_mode": "Markdown",
        "reply_markup": {"inline_keyboard": []}
    })

def main():
    print("Telegram Bot listener started...")
    last_update_id = 0
    while True:
        try:
            resp = requests.get(f"{BASE_URL}/getUpdates?offset={last_update_id}&timeout=30").json()
            if not resp.get("ok"):
                time.sleep(2)
                continue
                
            for update in resp.get("result", []):
                last_update_id = update["update_id"] + 1
                
                if "callback_query" in update:
                    cb = update["callback_query"]
                    cb_id = cb["id"]
                    data = cb.get("data", "")
                    message = cb.get("message", {})
                    chat_id = message.get("chat", {}).get("id")
                    message_id = message.get("message_id")
                    
                    if data.startswith("approve_") or data.startswith("reject_"):
                        action, leave_id = data.split("_", 1)
                        new_status = "approved" if action == "approve" else "rejected"
                        
                        if update_db_status(leave_id, new_status):
                            answer_callback(cb_id, f"Pengajuan {new_status}!")
                            
                            # Edit message text to show status
                            old_text = message.get("caption") or message.get("text") or ""
                            status_emoji = "✅ DISETUJUI" if new_status == "approved" else "❌ DITOLAK"
                            new_text = f"{old_text}\n\n*Status:* {status_emoji}"
                            edit_message(chat_id, message_id, new_text)
                        else:
                            answer_callback(cb_id, "Gagal mengupdate database!")
                            
        except Exception as e:
            print("Error polling:", e)
            time.sleep(5)

if __name__ == "__main__":
    main()
