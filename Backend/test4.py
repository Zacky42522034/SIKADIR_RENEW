import numpy as np
from deepface.modules import representation
import traceback

print("Testing direct representation extraction...")
try:
    dummy_img = np.zeros((224, 224, 3), dtype=np.uint8)
    res = representation.represent(img_path=dummy_img, model_name='Facenet', detector_backend='ssd', enforce_detection=False)
    print("Result:", res)
except Exception as e:
    print("Error:", str(e))
    traceback.print_exc()
