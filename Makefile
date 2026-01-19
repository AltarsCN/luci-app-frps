# This is free software, licensed under the Apache License, Version 2.0

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI Support for frp server
LUCI_DEPENDS:=+luci-base +frps

PKG_LICENSE:=Apache-2.0

# 解决与上游 frps 包的文件冲突
# 上游 frps 包也包含 /etc/config/frps 和 /etc/init.d/frps
# 使用 preinst 脚本在安装前删除这些冲突文件
define Package/luci-app-frps/preinst
#!/bin/sh
# 构建时安装：删除 staging 目录中的冲突文件
if [ -n "$${IPKG_INSTROOT}" ]; then
	rm -f "$${IPKG_INSTROOT}/etc/config/frps" 2>/dev/null
	rm -f "$${IPKG_INSTROOT}/etc/init.d/frps" 2>/dev/null
else
	# 运行时安装：删除目标系统中的冲突文件
	rm -f /etc/config/frps 2>/dev/null
	rm -f /etc/init.d/frps 2>/dev/null
fi
exit 0
endef

define Package/luci-app-frps/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	# 卸载后重新安装 frps 默认配置（如果 frps 仍然存在）
	[ -x /etc/init.d/frps ] || [ -f /usr/bin/frps ] && {
		# frps 二进制存在但配置丢失，创建空配置
		[ -f /etc/config/frps ] || touch /etc/config/frps
	}
}
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
