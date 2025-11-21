exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, hello: 'world', 接口状态: '旧版本CLI最终可用' })
  };
};