import numpy as np
from deepface import DeepFace
import traceback

print("Testing SSD detector...")
try:
    dummy_img = np.zeros((224, 224, 3), dtype=np.uint8)
    res = DeepFace.verify(img1_path=dummy_img, img2_path=dummy_img, model_name='Facenet', detector_backend='ssd', enforce_detection=False)
    print("Result:", res)
except Exception as e:
    print("Error:", str(e))
    traceback.print_exc()
