-- v224：机构专属入口品牌化——按域名定制登录页 Logo 与底部署名
-- organizations.portal_host：专属入口域名（如 yh.sanhao.sssx.club），唯一、可空（空=未开通专属入口）
-- organizations.portal_footer：登录页底部署名，默认「上上升学」
ALTER TABLE `organizations` ADD COLUMN `portal_host` varchar(128) NULL;
ALTER TABLE `organizations` ADD COLUMN `portal_footer` varchar(64) NOT NULL DEFAULT '上上升学';
CREATE UNIQUE INDEX `organizations_portal_host_uidx` ON `organizations` (`portal_host`);
