import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER
  await transporter.sendMail({
    from,
    to,
    subject: "【Harbvisitor】IDとパスワードの再設定",
    text: [
      "Harbvisitor（見沼氷川公園 ハーブ園 来園者アプリ）からのご連絡です。",
      "",
      "IDとパスワードの再設定リンクをお送りします。",
      "以下のURLにアクセスして、新しいIDとパスワードを設定してください。",
      "",
      resetUrl,
      "",
      "このリンクの有効期限は1時間です。",
      "ご自身で再設定を依頼していない場合はこのメールを無視してください。",
    ].join("\n"),
    html: `
      <p>Harbvisitor（見沼氷川公園 ハーブ園 来園者アプリ）からのご連絡です。</p>
      <p>IDとパスワードの再設定リンクをお送りします。<br>
      以下のボタンをクリックして、新しいIDとパスワードを設定してください。</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#4a7c59;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
          IDとパスワードを再設定する
        </a>
      </p>
      <p style="color:#666;font-size:12px;">このリンクの有効期限は1時間です。<br>
      ご自身で再設定を依頼していない場合はこのメールを無視してください。</p>
    `,
  })
}
