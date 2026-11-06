export async function saveCoachingFile(file: { fileName: string; mimeType: string; data: string }): Promise<void> {
  let blob: Blob;
  if (file.data.startsWith("data:")) {
    const response = await fetch(file.data);
    blob = await response.blob();
  } else if (file.mimeType.startsWith("text/")) {
    blob = new Blob([file.data], { type: file.mimeType });
  } else {
    const binary = atob(file.data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    blob = new Blob([bytes], { type: file.mimeType });
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
