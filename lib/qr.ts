export async function generateQRCode(text: string): Promise<string> {
  try {
    const response = await fetch("/api/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) throw new Error("QR generation failed")

    const data = await response.json()
    return data.qrCode
  } catch (error) {
    console.error("QR code generation error:", error)
    return ""
  }
}
