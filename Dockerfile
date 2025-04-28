# 使用一个合适的 Node.js 基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json (如果存在)
COPY package*.json ./

# 安装依赖
RUN npm install --omit=dev
# 如果你需要全局安装某些工具，可以在这里添加

# 复制应用代码到工作目录
COPY . .

# 暴露应用监听的端口 (与 .env 文件或 server.js 中的 PORT 一致)
EXPOSE 6911

# 定义容器启动时运行的命令
CMD [ "node", "server.js" ]