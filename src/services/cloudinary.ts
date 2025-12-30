// Cloudinary image upload service
const CLOUD_NAME = 'dujntgrjd';
const UPLOAD_PRESET = 'gametok_avatars';

export const uploadImage = async (imageUri: string): Promise<string> => {
  const formData = new FormData();
  
  // Get file extension
  const uriParts = imageUri.split('.');
  const fileType = uriParts[uriParts.length - 1] || 'jpg';
  
  formData.append('file', {
    uri: imageUri,
    type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
    name: `avatar.${fileType}`,
  } as any);
  
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', 'avatars');
  
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      console.log('Cloudinary error:', data);
      throw new Error(data.error?.message || 'Failed to upload image');
    }
    
    return data.secure_url;
  } catch (error) {
    console.log('Upload error details:', error);
    throw error;
  }
};
