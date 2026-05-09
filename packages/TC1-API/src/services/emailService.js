const sendResetPasswordEmail = async (email, resetToken) => {
  const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;
  
  console.log('='.repeat(60));
  console.log('【模拟 SMTP 邮件发送】');
  console.log(`收件人: ${email}`);
  console.log(`主题: 密码重置请求`);
  console.log('-' .repeat(60));
  console.log('邮件内容:');
  console.log(`  您好！`);
  console.log(`  您请求了密码重置，请使用以下链接重置密码：`);
  console.log(`  ${resetLink}`);
  console.log(`  该链接将在 15 分钟后过期。`);
  console.log(`  如果您没有请求密码重置，请忽略此邮件。`);
  console.log('='.repeat(60));
  
  console.log(`\n[开发提示] 密码重置令牌: ${resetToken}\n`);
  
  return {
    success: true,
    message: '模拟邮件发送成功',
    resetToken
  };
};

module.exports = {
  sendResetPasswordEmail
};
