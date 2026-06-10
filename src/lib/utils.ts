import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ipToLong(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

export function longToIp(long: number): string {
  return [
    (long >>> 24) & 255,
    (long >>> 16) & 255,
    (long >>> 8) & 255,
    long & 255
  ].join('.');
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generateHtmlReport(title: string, rawContent: string): string {
  const lines = rawContent.split('\n');
  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - 网络专家诊断报告</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
            color: #1e293b;
            background-color: #f1f5f9;
            line-height: 1.6;
            margin: 0;
            padding: 40px 20px;
        }
        .container {
            max-width: 850px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #4f46e5 0%, #312e81 100%);
            color: #ffffff;
            padding: 36px 45px;
            position: relative;
        }
        .header h1 {
            margin: 0;
            font-size: 26px;
            font-weight: 800;
            letter-spacing: -0.025em;
        }
        .header .meta-sub {
            margin: 8px 0 0 0;
            font-size: 13px;
            color: #c7d2fe;
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }
        .content {
            padding: 45px;
        }
        .section-title {
            font-size: 16px;
            font-weight: 700;
            color: #1e3a8a;
            border-bottom: 2px solid #f1f5f9;
            padding-bottom: 10px;
            margin-top: 36px;
            margin-bottom: 18px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .section-title::before {
            content: "";
            display: inline-block;
            width: 4px;
            height: 18px;
            background-color: #4f46e5;
            border-radius: 2px;
        }
        .meta-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        .meta-item {
            background-color: #f8fafc;
            padding: 12px 18px;
            border-radius: 10px;
            border: 1px solid #f1f5f9;
            border-left: 4px solid #cbd5e1;
        }
        .meta-label {
            font-size: 11px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
        }
        .meta-value {
            font-size: 13px;
            font-weight: 600;
            color: #334155;
            margin-top: 4px;
            word-break: break-all;
        }
        pre {
            background-color: #0f172a;
            color: #38bdf8;
            padding: 18px;
            border-radius: 10px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
            font-size: 12px;
            overflow-x: auto;
            line-height: 1.6;
            margin: 14px 0;
            border-left: 4px solid #4f46e5;
        }
        .footer {
            text-align: center;
            padding: 28px;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px solid #f1f5f9;
            background-color: #fafbfc;
        }
        .btn-print {
            background-color: #4f46e5;
            color: #ffffff;
            border: none;
            padding: 8px 18px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .btn-print:hover {
            background-color: #4338ca;
        }
        
        @media print {
            body {
                background-color: #ffffff;
                padding: 0;
            }
            .container {
                border: none;
                box-shadow: none;
                max-width: 100%;
            }
            .no-print {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${title}</h1>
            <div class="meta-sub">
                <span>生成系统: 一站式网络诊断及管理工具箱</span>
                <span>•</span>
                <span>导出日期: ${new Date().toLocaleString()}</span>
            </div>
        </div>
        <div class="content">`;

  let currentSection = '';
  let inPre = false;
  let preContent: string[] = [];
  let metaItems: { label: string; value: string }[] = [];

  const flushPre = () => {
    if (inPre && preContent.length > 0) {
      html += `<pre><code>${preContent.join('\n')}</code></pre>`;
      preContent = [];
      inPre = false;
    }
  };

  const flushMeta = () => {
    if (metaItems.length > 0) {
      html += `<div class="meta-grid">`;
      metaItems.forEach(item => {
        html += `
          <div class="meta-item">
              <div class="meta-label">${escapeHtml(item.label)}</div>
              <div class="meta-value">${escapeHtml(item.value)}</div>
          </div>`;
      });
      html += `</div>`;
      metaItems = [];
    }
  };

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Headings parse
    const matchHeader = trimmed.match(/^===\s*(.*?)\s*===$/);
    if (matchHeader) {
      flushPre();
      flushMeta();
      const secTitle = matchHeader[1];
      html += `<div class="section-title">${escapeHtml(secTitle)}</div>`;
      currentSection = secTitle;
      continue;
    }

    // Key values metadata check
    const matchMeta = trimmed.match(/^([^:=]+)[:=]\s*(.+)$/);
    if (matchMeta && !trimmed.startsWith('http') && !trimmed.startsWith('https') && !inPre && trimmed.length < 150) {
      metaItems.push({
        label: matchMeta[1].trim(),
        value: matchMeta[2].trim()
      });
    } else {
      flushMeta();
      if (!inPre) {
        inPre = true;
      }
      preContent.push(escapeHtml(line));
    }
  }

  flushPre();
  flushMeta();

  html += `
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} 一站式网络管理及分析诊断工具 (Suite Admin) • 机密运维文件</p>
            <p class="no-print" style="margin-top: 10px;">
                <button class="btn-print" onclick="window.print()">打印当前诊断单 / 导出物理 PDF</button>
            </p>
        </div>
    </div>
</body>
</html>`;

  return html;
}

export function downloadReport(title: string, content: string) {
  // Clear any existing overlay to prevent leaks
  const modalId = 'download-report-modal-overlay';
  const oldModal = document.getElementById(modalId);
  if (oldModal) {
    oldModal.remove();
  }

  const isInIframe = window.self !== window.top;

  // Create UI overlay container
  const modal = document.createElement('div');
  modal.id = modalId;
  // Apply visual presentation stylings inline to bypass uncompiled custom Tailwind styles
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '999999';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.backgroundColor = 'rgba(15, 23, 42, 0.65)';
  modal.style.backdropFilter = 'blur(4px)';
  modal.style.padding = '16px';
  modal.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  modal.style.transition = 'opacity 0.25s ease-out';
  modal.style.opacity = '0';

  const modalInnerHTML = `
    <div id="download-report-modal-content" style="
      background-color: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      width: 100%;
      max-width: 450px;
      overflow: hidden;
      transform: scale(0.95);
      transition: transform 0.25s ease-out, opacity 0.25s ease-out;
      opacity: 0;
    ">
      <!-- Header banner -->
      <div style="
        padding: 16px 24px;
        background-color: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg style="width: 20px; height: 20px; color: #4f46e5;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <span style="font-weight: 700; color: #1e293b; font-size: 15px;">选择报告导出格式</span>
        </div>
        <button id="download-report-modal-close" style="
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        " onmouseover="this.style.backgroundColor='#f1f5f9'; this.style.color='#475569';" onmouseout="this.style.backgroundColor='transparent'; this.style.color='#94a3b8';">
          <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <!-- Content choices list -->
      <div id="selection-panel" style="padding: 24px; display: flex; flex-direction: column; gap: 12px;">
        <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">系统已为您准备好检测数据结果。请选择所需的文档模板格式文件：</p>
        
        <!-- Standard Text Option -->
        <button id="export-txt-btn" style="
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background-color: #ffffff;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          width: 100%;
        " onmouseover="this.style.borderColor='#4f46e5'; this.style.backgroundColor='#f5f3ff';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.backgroundColor='#ffffff';">
          <div style="
            background-color: #e0e7ff;
            color: #4f46e5;
            padding: 8px;
            border-radius: 8px;
            display: flex;
            align-items: center;
          ">
            <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 13px; color: #1e293b;">经典纯文本格式 (.txt)</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">最紧凑的网络指标日志文本，适合存证或命令行解析。</div>
          </div>
        </button>

        <!-- HTML Option -->
        <button id="export-html-btn" style="
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background-color: #ffffff;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          width: 100%;
        " onmouseover="this.style.borderColor='#4f46e5'; this.style.backgroundColor='#f5f3ff';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.backgroundColor='#ffffff';">
          <div style="
            background-color: #e0e7ff;
            color: #4f46e5;
            padding: 8px;
            border-radius: 8px;
            display: flex;
            align-items: center;
          ">
            <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 13px; color: #1e293b;">交互式多维网页报告 (.html)</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">内嵌高对比样式单和表单数据栏位，具有极佳视觉表现。</div>
          </div>
        </button>

        <!-- PDF Option (Teal/Emerald Color representation changed to Indigo brand unified style) -->
        <button id="export-pdf-btn" style="
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background-color: #ffffff;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          width: 100%;
        " onmouseover="this.style.borderColor='#4f46e5'; this.style.backgroundColor='#f5f3ff';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.backgroundColor='#ffffff';">
          <div style="
            background-color: #e0e7ff;
            color: #4f46e5;
            padding: 8px;
            border-radius: 8px;
            display: flex;
            align-items: center;
          ">
            <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 13px; color: #1e293b;">高品质标准 PDF 诊断单 (.pdf)</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">专业纸张标准物理页尺寸精确排版，包含独立页打印样式。</div>
          </div>
        </button>

        ${isInIframe ? `
          <!-- Unified styling tips box - fully clean with no red borders/fonts -->
          <div style="
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 12px;
            font-size: 11.5px;
            color: #475569;
            line-height: 1.5;
            margin-top: 8px;
            display: flex;
            gap: 8px;
          ">
            <svg style="width: 16px; height: 16px; shrink: 0; color: #64748b; margin-top: 2px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <div>
              <strong>环境提示</strong>：因为当前应用处于内嵌预览环境中，浏览器默认会拦截直接开启的打印对话框。可点击面板中的 PDF 导出获取物理印单。
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  modal.innerHTML = modalInnerHTML;
  document.body.appendChild(modal);

  // Animate Entrance
  setTimeout(() => {
    modal.style.opacity = '1';
    const content = document.getElementById('download-report-modal-content');
    if (content) {
      content.style.transform = 'scale(1)';
      content.style.opacity = '1';
    }
  }, 10);

  // Close Event Helpers
  const dismissModal = () => {
    modal.style.opacity = '0';
    const content = document.getElementById('download-report-modal-content');
    if (content) {
      content.style.transform = 'scale(0.95)';
      content.style.opacity = '0';
    }
    setTimeout(() => {
      modal.remove();
    }, 250);
  };

  // Close bindings
  document.getElementById('download-report-modal-close')?.addEventListener('click', dismissModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      dismissModal();
    }
  });

  // Common UI Switch Helper of Loading state
  const showLoadingState = (titleText: string, subtitleText: string) => {
    const selectionPanel = document.getElementById('selection-panel');
    if (selectionPanel) {
      selectionPanel.innerHTML = `
        <div id="loading-panel" style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 44px 16px;
          text-align: center;
        ">
          <!-- Elegant loading spinner -->
          <div class="loader-spinner" style="
            width: 38px;
            height: 38px;
            border: 3.5px solid #f3f3f3;
            border-top: 3.5px solid #4f46e5;
            border-radius: 50%;
            animation: modal-spin 1s linear infinite;
            margin-bottom: 18px;
          "></div>
          <div style="font-weight: 700; font-size: 14.5px; color: #1e293b; margin-bottom: 6px;">${titleText}</div>
          <div style="font-size: 12px; color: #64748b; line-height: 1.5; max-width: 320px;">${subtitleText}</div>
        </div>
        <style>
          @keyframes modal-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
    }
  };

  // Action: Export TXT
  document.getElementById('export-txt-btn')?.addEventListener('click', () => {
    showLoadingState("正在处理诊断日志数据...", "正在抽取经典纯文本报表日志并进行环境封装，请勿关闭弹框。");

    setTimeout(() => {
      try {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/\s+/g, '_').toLowerCase()}_report_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        dismissModal();
      } catch (err) {
        console.error("TXT report download error:", err);
        alert(`导出 TXT 文本遇到错误: ${(err as Error).message || '未知异常'}`);
        dismissModal();
      }
    }, 900);
  });

  // Action: Export HTML
  document.getElementById('export-html-btn')?.addEventListener('click', () => {
    showLoadingState("正在生成交互式多维网页...", "正在将图表统计信息与纯文本排版整合，进行多视图表现优化中...");

    setTimeout(() => {
      try {
        const reportHtml = generateHtmlReport(title, content);
        const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/\s+/g, '_').toLowerCase()}_report_${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        dismissModal();
      } catch (err) {
        console.error("HTML report download error:", err);
        alert(`导出 HTML 网页遇到错误: ${(err as Error).message || '未知异常'}`);
        dismissModal();
      }
    }, 900);
  });

  // Action: Export PDF
  document.getElementById('export-pdf-btn')?.addEventListener('click', () => {
    showLoadingState("正在进行物理纸张排版计算...", "正在自适应精确对齐 A4 画布并渲染离线下载底本，请稍候...");

    setTimeout(() => {
      let isSuccess = false;
      let errorInstance: Error | null = null;
      let reportHtml = "";

      try {
        reportHtml = generateHtmlReport(title, content);

        // 1. Silent download setup for double download reliability
        const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/\s+/g, '_').toLowerCase()}_report_for_pdf_print.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // 2. Load printer iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '-10000px';
        iframe.style.bottom = '-10000px';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(reportHtml);
          doc.close();

          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (printErr) {
            console.warn("Iframe native print call failed, gracefully resorting to guides", printErr);
          }

          // Garbage collect iframe
          setTimeout(() => {
            if (iframe.parentNode) {
              document.body.removeChild(iframe);
            }
          }, 1500);
        }

        isSuccess = true;
      } catch (err) {
        console.error("PDF generator flow threw exception:", err);
        errorInstance = err as Error;
      }

      // 3. Render informational screen based on success/error state
      const modalContent = document.getElementById('download-report-modal-content');
      if (modalContent) {
        if (isSuccess) {
          modalContent.innerHTML = `
            <!-- Success/Information Header -->
            <div style="
              padding: 16px 24px;
              background-color: #f0fdf4;
              border-bottom: 1px solid #e2e8f0;
              display: flex;
              align-items: center;
              justify-content: space-between;
            ">
              <div style="display: flex; align-items: center; gap: 8px;">
                <svg style="width: 20px; height: 20px; color: #10b981;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span style="font-weight: 700; color: #065f46; font-size: 15px;">PDF 导出流程已启动</span>
              </div>
              <button id="success-modal-close" style="
                background: none;
                border: none;
                color: #94a3b8;
                cursor: pointer;
                padding: 4px;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
              " onmouseover="this.style.backgroundColor='#dcfce7'; this.style.color='#065f46';" onmouseout="this.style.backgroundColor='transparent'; this.style.color='#94a3b8';">
                <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <!-- Details and Guidelines -->
            <div style="padding: 24px; display: flex; flex-direction: column; gap: 14px; line-height: 1.5; text-align: left;">
              <div style="font-weight: 700; font-size: 13.5px; color: #065f46;">📝 成功为您生成并下载高度对齐排版的专用物理印单！</div>
              
              <div style="color: #475569; font-size: 12.5px;">
                为了确保您的数据顺利导出，系统已完成排版转换并为您下载了备份页面归档：
              </div>

              <div style="
                background-color: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 12px;
                font-size: 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
              ">
                <div style="display: flex; gap: 6px;">
                  <span style="color: #4f46e5; font-weight: 750; shrink: 0;">一轨机制：</span>
                  <span style="color: #334155;">下载物理格式为 <code>..._report_for_pdf_print.html</code> 的排版文件。</span>
                </div>
                <div style="display: flex; gap: 6px; border-top: 1px dashed #e2e8f0; padding-top: 8px;">
                  <span style="color: #4f46e5; font-weight: 750; shrink: 0;">二轨机制：</span>
                  <span style="color: #334155;">程序尝试为您同步唤起浏览器的系统级打印。</span>
                </div>
              </div>

              <div style="
                background-color: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 12px;
                color: #475569;
                font-size: 11.5px;
              ">
                <strong style="display: block; margin-bottom: 4px; color: #1e293b;">💡 未看到打印窗口弹出？</strong>
                这是极其正常的。现代浏览器出于防钓鱼和反劫持安全防范机制，是不允许在内嵌 Iframe 块内由应用静默强制弹出打印窗口的。
                <div style="margin-top: 8px; border-top: 1px dotted #e2e8f0; padding-top: 6px; font-weight: 600;">
                  ✨ 完美解决方案：
                  <ol style="margin: 4px 0 0 16px; padding: 0;">
                    <li>双击您电脑磁盘中刚下载好的 <code>.html</code> 备份文件。</li>
                    <li>直接在弹出的干净独立纯白页面中按下键盘上的 <strong>Ctrl + P</strong> (MacOS 为 <strong>Cmd + P</strong>)。</li>
                    <li>在打印设置中将“目标打印机”更改为 <b>“另存为 PDF”</b> 并保存，排版与解析度100%对齐完美！</li>
                  </ol>
                </div>
              </div>

              <button id="success-done-btn" style="
                background-color: #4f46e5;
                color: #ffffff;
                border: none;
                padding: 10px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: background-color 0.2s;
                text-align: center;
                margin-top: 4px;
              " onmouseover="this.style.backgroundColor='#4338ca';" onmouseout="this.style.backgroundColor='#4f46e5';">
                好的，我已知晓
              </button>
            </div>
          `;
        } else {
          // Errored presentation state
          modalContent.innerHTML = `
            <!-- Error Header -->
            <div style="
              padding: 16px 24px;
              background-color: #fafafa;
              border-bottom: 1px solid #e5e7eb;
              display: flex;
              align-items: center;
              justify-content: space-between;
            ">
              <div style="display: flex; align-items: center; gap: 8px;">
                <svg style="width: 20px; height: 20px; color: #64748b;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <span style="font-weight: 700; color: #374151; font-size: 15px;">PDF 导出说明</span>
              </div>
              <button id="success-modal-close" style="
                background: none;
                border: none;
                color: #94a3b8;
                cursor: pointer;
                padding: 4px;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
              " onmouseover="this.style.backgroundColor='#f1f5f9'; this.style.color='#1e293b';" onmouseout="this.style.backgroundColor='transparent'; this.style.color='#94a3b8';">
                <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <!-- Details and Guidelines -->
            <div style="padding: 24px; display: flex; flex-direction: column; gap: 14px; line-height: 1.5; text-align: left;">
              <div style="font-weight: 700; font-size: 13.5px; color: #374151;">⚠️ 浏览器安全策略限制了脚本打印动作</div>
              
              <div style="color: #475569; font-size: 12.5px;">
                部分严格浏览器安全防火墙拦截了打印调用：${errorInstance ? errorInstance.message : "受沙盒策略约束"}。但我们已顺利为您自动下载了本地专属印单。
              </div>

              <div style="
                background-color: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 12px;
                font-size: 12px;
              ">
                <strong>💡 极速物理生成步骤：</strong>
                <ol style="margin: 6px 0 0 16px; padding: 0; color: #475569;">
                  <li>打开本地系统刚才下载取得的 <code>html</code> 印单网页文件。</li>
                  <li>按组合键 <strong>Ctrl + P</strong> 调出标准的打印首选项设置。</li>
                  <li>更改“目标打印机”或者格式模式为 <b>“另存为 PDF 文件”</b> 并确认，可永久高质量无损离线查阅保存！</li>
                </ol>
              </div>

              <button id="success-done-btn" style="
                background-color: #4f46e5;
                color: #ffffff;
                border: none;
                padding: 10px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: background-color 0.2s;
                text-align: center;
                margin-top: 4px;
              " onmouseover="this.style.backgroundColor='#4338ca';" onmouseout="this.style.backgroundColor='#4f46e5';">
                好的，我已知晓
              </button>
            </div>
          `;
        }

        // Bind close actions for the Success/Error screen
        document.getElementById('success-modal-close')?.addEventListener('click', dismissModal);
        document.getElementById('success-done-btn')?.addEventListener('click', dismissModal);
      }
    }, 1200);
  });
}

export function parseTargetRanges(input: string): string[] {
  const targets = new Set<string>();
  const parts = input.split(',').map(s => s.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes('/')) {
      // CIDR
      const [ipStr, cidrStr] = part.split('/');
      const cidr = parseInt(cidrStr, 10);
      if (cidr >= 0 && cidr <= 32) {
        const ipLong = ipToLong(ipStr);
        const mask = ~(0xffffffff >>> cidr);
        const network = (ipLong & mask) >>> 0;
        const broadcast = (network | ~mask) >>> 0;
        for (let i = network + 1; i < broadcast; i++) {
          targets.add(longToIp(i));
        }
      } else {
        targets.add(part);
      }
    } else if (part.includes('-')) {
      const [startIpStr, endMatch] = part.split('-');
      // Check if end is numeric (e.g. 192.168.1.1-10) or full IP (192.168.1.1-192.168.1.10)
      if (endMatch.includes('.')) {
         const startLong = ipToLong(startIpStr.trim());
         const endLong = ipToLong(endMatch.trim());
         const max = Math.min(startLong + 256, endLong); // prevent massive blocks
         for(let i = startLong; i <= max; i++) targets.add(longToIp(i));
      } else {
         const endOctet = parseInt(endMatch.trim(), 10);
         const startParts = startIpStr.trim().split('.');
         if (startParts.length === 4) {
             const startOctet = parseInt(startParts[3], 10);
             if (!isNaN(startOctet) && !isNaN(endOctet) && startOctet <= endOctet) {
                 for(let i = startOctet; i <= endOctet; i++) {
                     targets.add(`${startParts[0]}.${startParts[1]}.${startParts[2]}.${i}`);
                 }
             } else {
                 targets.add(part);
             }
         } else {
             targets.add(part); 
         }
      }
    } else {
      targets.add(part);
    }
  }
  
  return Array.from(targets);
}
