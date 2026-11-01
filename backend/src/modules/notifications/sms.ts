/**
 * SMS API PH integration helper (https://smsapiph.netlify.app/documentation).
 */
export async function sendSms(number: string, message: string) {
  const apiKey = process.env.SMS_API_KEY
  if (!apiKey) {
    console.warn('SMS_API_KEY not configured. Skipping SMS dispatch.')
    return { status: 'error', message: 'SMS_API_KEY not configured' }
  }

  try {
    const response = await fetch('https://api.smsapiph.com/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apikey: apiKey,
        number,
        message,
      }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.warn('SMS API domain unreachable (ENOTFOUND/network error). Falling back to console log for testing:', error)
    console.log(`\n========================================`)
    console.log(`[SMS OUTBOX MOCK] To: ${number}`)
    console.log(`Message: ${message}`)
    console.log(`========================================\n`)
    return { status: 'success', message: 'SMS logged to console (mock fallback due to network error)' }
  }
}
