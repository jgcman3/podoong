// Capture the real anonymous introduction page, then overlay clearly labelled
// browser-menu reconstructions. These are instructional captures, not OS captures.
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Share,
  Ellipsis,
  EllipsisVertical,
  Download,
  PlusSquare,
  Bell,
} from 'lucide-react';
const origin = process.env.PODOONG_GUIDE_ORIGIN ?? 'http://127.0.0.1:3187';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
  throw new Error('Capture only an anonymous local page');
const output = 'public/guides/install/v1';
await mkdir(output, { recursive: true });
const brand =
  'data:image/png;base64,' +
  (await readFile('public/icons/podung-192.png')).toString('base64');
const icon = (component) =>
  renderToStaticMarkup(
    createElement(component, { size: 20, strokeWidth: 1.7 }),
  );
const browser = await chromium.launch();
try {
  const source = await browser.newPage({
    viewport: { width: 390, height: 420 },
    deviceScaleFactor: 2,
  });
  const canvas = await browser.newPage({
    viewport: { width: 360, height: 250 },
    deviceScaleFactor: 2,
  });
  for (const locale of ['ko', 'en']) {
    const ko = locale === 'ko';
    await source.goto(`${origin}/${locale}/intro`);
    await source.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    });
    await source.evaluate(() => document.fonts.ready);
    const actual = (
      await source.screenshot({ animations: 'disabled' })
    ).toString('base64');
    const t = ko
      ? {
          cancel: '취소',
          add: '추가',
          install: '설치',
          name: '포둥',
          share: '공유',
          addHome: '홈 화면에 추가',
          webapp: '웹 앱으로 열기',
          shortcuts: '설치 및 바로가기 만들기',
          pageInstall: '페이지를 앱으로 설치…',
          saveShare: '전송, 저장 및 공유',
          dock: 'Dock에 추가…',
          allow: '허용',
          deny: '허용 안 함',
          permission: '“포둥”에서 알림을 보내고자 합니다',
          browserPermission: 'podoong.com에서 알림을 표시하려고 합니다',
          notify: '이 기기에서 알림 켜기',
          reminders: '식사 알림',
          modes: '간격 기준　 어제 식사 시간　 끄기',
        }
      : {
          cancel: 'Cancel',
          add: 'Add',
          install: 'Install',
          name: 'podoong',
          share: 'Share',
          addHome: 'Add to Home Screen',
          webapp: 'Open as Web App',
          shortcuts: 'Install & create shortcuts',
          pageInstall: 'Install page as app…',
          saveShare: 'Cast, save and share',
          dock: 'Add to Dock…',
          allow: 'Allow',
          deny: 'Don’t Allow',
          permission: '“podoong” Would Like to Send You Notifications',
          browserPermission: 'podoong.com wants to show notifications',
          notify: 'Enable on this device',
          reminders: 'Feeding reminders',
          modes: 'Interval　 Yesterday　 Off',
        };
    const miniBrand = `<img class="appicon" src="${brand}" alt="">`;
    const highlighted = (text, symbol = '') =>
      `<div class="row selected">${symbol}<span>${text}</span></div>`;
    const row = (text) => `<div class="row">${text}</div>`;
    for (const platform of ['ios', 'android', 'desktop', 'mac-safari']) {
      for (let step = 1; step <= 4; step++) {
        let chrome = '',
          overlay = '';
        if (platform === 'ios') {
          chrome = `<div class="iosbar"><span>‹</span><span class="address">podoong.com</span><span class="${step === 1 ? 'target' : ''}">${icon(Share)}</span><span>${icon(Ellipsis)}</span></div>`;
          if (step === 2)
            overlay = `<section class="sheet"><div class="handle"></div><div class="app-line">${miniBrand}<div><b>${t.name}</b><small>podoong.com</small></div></div>${row(ko ? '복사' : 'Copy')}${highlighted(t.addHome, icon(PlusSquare))}</section>`;
          if (step === 3)
            overlay = `<section class="sheet"><div class="sheetbar"><span>${t.cancel}</span><b>${t.addHome}</b><span class="target">${t.add}</span></div><div class="app-line">${miniBrand}<div><b>${t.name}</b><small>podoong.com</small></div></div><div class="row toggle-row"><span>${t.webapp}</span><i class="toggle"></i></div></section>`;
        } else if (platform === 'android') {
          chrome = `<div class="topbar"><span class="address">podoong.com</span><span class="${step === 1 ? 'target' : ''}">${icon(EllipsisVertical)}</span></div>`;
          if (step === 2)
            overlay = `<section class="menu">${row(ko ? '새 탭' : 'New tab')}${row(ko ? '북마크' : 'Bookmarks')}${highlighted(t.shortcuts, icon(Download))}${highlighted(t.install)}</section>`;
          if (step === 3)
            overlay = `<section class="confirm"><h3>${ko ? '앱 설치' : 'Install app'}</h3><div class="app-line">${miniBrand}<div><b>${t.name}</b><small>podoong.com</small></div></div><div class="actions"><span>${t.cancel}</span><span class="action-target">${t.install}</span></div></section>`;
        } else if (platform === 'mac-safari') {
          chrome = `<div class="menubar"><b>Safari</b><span class="${step === 1 ? 'target' : ''}">${ko ? '파일' : 'File'}</span><span>${ko ? '편집' : 'Edit'}</span><span>${ko ? '보기' : 'View'}</span></div><div class="topbar mac"><span class="address">podoong.com</span><span>${icon(Share)}</span></div>`;
          if (step === 2)
            overlay = `<section class="menu macmenu">${row(ko ? '새로운 윈도우' : 'New Window')}${row(ko ? '새로운 탭' : 'New Tab')}${highlighted(t.dock, icon(Download))}</section>`;
          if (step === 3)
            overlay = `<section class="confirm"><div class="app-line">${miniBrand}<div><b>${t.name}</b><small>podoong.com</small></div></div><div class="actions"><span>${t.cancel}</span><span class="action-target">${t.add}</span></div></section>`;
        } else {
          chrome = `<div class="topbar"><span class="address">podoong.com</span><span class="${step === 1 ? 'target' : ''}">${icon(Download)}</span><span>${icon(EllipsisVertical)}</span></div>`;
          if (step === 2)
            overlay = `<section class="menu">${row(ko ? '새 탭' : 'New tab')}${row(t.saveShare)}${highlighted(t.pageInstall, icon(Download))}</section>`;
          if (step === 3)
            overlay = `<section class="confirm"><h3>${ko ? '이 페이지를 앱으로 설치할까요?' : 'Install this page as an app?'}</h3><div class="app-line">${miniBrand}<div><b>${t.name}</b><small>podoong.com</small></div></div><div class="actions"><span>${t.cancel}</span><span class="action-target">${t.install}</span></div></section>`;
        }
        if (step === 4) {
          overlay = `<section class="settings"><b>${icon(Bell)} ${t.reminders}</b><div class="modes">${t.modes}</div><span class="enable">${t.notify}</span></section><section class="permission"><b>${platform === 'ios' ? t.permission : t.browserPermission}</b><div class="actions"><span>${t.deny}</span><span class="action-target">${t.allow}</span></div></section>`;
        }
        await canvas.setContent(`<!doctype html><html lang="${locale}"><meta charset="utf-8"><style>
          *{box-sizing:border-box}body{margin:0;background:#eef0f4;font:12px -apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;color:#303b4b}svg{flex-shrink:0}.scene{height:250px;position:relative;overflow:hidden;border:1px solid #e0e5ed;border-radius:14px}.page{width:100%;height:100%;object-fit:cover;object-position:top;opacity:.75}.topbar,.iosbar{height:43px;position:absolute;left:0;right:0;display:flex;align-items:center;justify-content:space-around;gap:10px;background:#f2f3f7;padding:6px 12px}.topbar{top:0}.iosbar{bottom:17px}.address{flex:1;background:white;border-radius:9px;text-align:center;padding:7px;font-size:11px}.target{outline:2px solid #697bb5;outline-offset:3px;border-radius:5px;padding:2px;color:#5267a8}.sheet,.menu,.confirm,.permission{position:absolute;background:#fff;box-shadow:0 5px 30px #1c263522;border:1px solid #e3e6ec;border-radius:15px}.sheet{bottom:17px;left:10px;right:10px;padding:12px 14px}.handle{width:30px;height:4px;background:#d4d7de;border-radius:4px;margin:-5px auto 11px}.app-line{display:flex;align-items:center;gap:11px;padding:10px 0}.appicon{width:43px;height:43px;border-radius:10px;background:#faf5ee;object-fit:contain}.app-line b{font-size:14px}.app-line small{display:block;color:#8190a4;margin-top:4px}.row{display:flex;align-items:center;gap:9px;min-height:34px;padding:8px 10px;border-radius:7px;font-size:12px}.selected{border:2px solid #697bb5;background:#f0f3fd;color:#40568f;margin:3px 0;font-weight:600}.menu{right:10px;top:42px;width:247px;padding:9px}.confirm{top:67px;left:24px;right:24px;padding:16px}.confirm h3{font-size:14px;margin:0 0 5px}.actions{display:flex;justify-content:flex-end;align-items:center;gap:18px;padding-top:14px;color:#66728a}.action-target{padding:7px 17px;background:#5267a8;border-radius:7px;color:white;font-weight:600}.sheetbar{display:flex;justify-content:space-between;align-items:center;font-size:11px;padding:3px 0 8px;color:#5267a8}.sheetbar b{color:#303b4b}.toggle-row{justify-content:space-between}.toggle{width:35px;height:21px;border-radius:15px;background:#5ca879;position:relative}.toggle:after{content:'';position:absolute;right:2px;top:2px;width:17px;height:17px;background:white;border-radius:50%}.menubar{position:absolute;top:0;left:0;right:0;height:28px;background:#f3f4f7;display:flex;align-items:center;gap:17px;padding:4px 15px;font-size:11px}.topbar.mac{top:28px}.macmenu{top:26px;left:55px;right:auto}.settings{position:absolute;top:36px;left:22px;right:22px;background:white;padding:14px;border-radius:12px;border:1px solid #e3e6ed}.settings>b{display:flex;align-items:center;gap:6px}.modes{font-size:10px;background:#f3f5fb;border-radius:7px;margin:12px 0;padding:10px;text-align:center}.enable{display:block;padding:9px;background:#5267a8;color:white;border-radius:8px;text-align:center;font-size:11px}.permission{top:115px;left:36px;right:36px;padding:16px;text-align:center}.permission>b{font-size:12px;display:block;line-height:1.6}.permission .actions{justify-content:space-between;font-size:11px;gap:8px}.note{position:absolute;left:0;right:0;bottom:0;height:17px;text-align:center;background:#f7f8fb;color:#8c96a4;font-size:8px;padding:3px}
        </style><div class="scene"><img class="page" src="data:image/png;base64,${actual}" alt="">${chrome}${overlay}<div class="note">${ko ? '안내용 재현 화면 · 메뉴는 버전에 따라 달라요' : 'Illustrated guide · browser menus may vary'}</div></div></html>`);
        await canvas.evaluate(() => document.fonts.ready);
        const buffer = await canvas.screenshot({ animations: 'disabled' });
        await sharp(buffer)
          .webp({ quality: 88 })
          .toFile(`${output}/${platform}-${locale}-${step}.webp`);
      }
    }
  }
  console.log(
    'Saved 32 localized instructional captures; no account or family data accessed.',
  );
} finally {
  await browser.close();
}
