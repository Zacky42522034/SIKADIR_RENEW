export interface VerifyResponse {
  verified: boolean;
  distance: number;
  threshold: number;
  model: string;
}

export const verifyFace = async (
  capturedImageBase64: string, 
  referenceImageUrl: string
): Promise<VerifyResponse> => {
  const API_URL = import.meta.env.VITE_DEEPFACE_URL || '/api/verify';
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        captured_image_base64: capturedImageBase64,
        reference_image_url: referenceImageUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to verify face');
    }

    return await response.json();
  } catch (error) {
    console.error('DeepFace Verification Error:', error);
    throw error;
  }
};
