(function() {
  let isInspectorActive = false;
  let inspectorStyle = null;
  let currentHighlight = null;

  // Function to get relevant styles
  function getRelevantStyles(element) {
    const computedStyles = window.getComputedStyle(element);
    const relevantProps = [
      'display', 'position', 'width', 'height', 'margin', 'padding',
      'border', 'background', 'color', 'font-size', 'font-family',
      'text-align', 'flex-direction', 'justify-content', 'align-items'
    ];
    
    const styles = {};
    relevantProps.forEach(prop => {
      const value = computedStyles.getPropertyValue(prop);
      if (value) styles[prop] = value;
    });
    
    return styles;
  }

  // Function to create a readable element selector
  function createReadableSelector(element) {
    let selector = element.tagName.toLowerCase();
    
    // Add ID if present
    if (element.id) {
      selector += `#${element.id}`;
    }
    
    // Add classes if present
    let className = '';
    if (element.className) {
      if (typeof element.className === 'string') {
        className = element.className;
      } else if (element.className.baseVal !== undefined) {
        className = element.className.baseVal;
      } else {
        className = element.className.toString();
      }
      
      if (className.trim()) {
        const classes = className.trim().split(/\s+/).slice(0, 3); // Limit to first 3 classes
        selector += `.${classes.join('.')}`;
      }
    }
    
    return selector;
  }

  // Function to create element display text
  function createElementDisplayText(element) {
    const tagName = element.tagName.toLowerCase();
    let displayText = `<${tagName}`;
    
    // Add ID attribute
    if (element.id) {
      displayText += ` id="${element.id}"`;
    }
    
    // Add class attribute (limit to first 3 classes for readability)
    let className = '';
    if (element.className) {
      if (typeof element.className === 'string') {
        className = element.className;
      } else if (element.className.baseVal !== undefined) {
        className = element.className.baseVal;
      } else {
        className = element.className.toString();
      }
      
      if (className.trim()) {
        const classes = className.trim().split(/\s+/);
        const displayClasses = classes.length > 3 ? 
          classes.slice(0, 3).join(' ') + '...' : 
          classes.join(' ');
        displayText += ` class="${displayClasses}"`;
      }
    }
    
    // Add other important attributes
    const importantAttrs = ['type', 'name', 'href', 'src', 'alt', 'title'];
    importantAttrs.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value) {
        const truncatedValue = value.length > 30 ? value.substring(0, 30) + '...' : value;
        displayText += ` ${attr}="${truncatedValue}"`;
      }
    });
    
    displayText += '>';
    
    // Add text content preview for certain elements
    const textElements = ['span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'a', 'label'];
    if (textElements.includes(tagName) && element.textContent) {
      const textPreview = element.textContent.trim().substring(0, 50);
      if (textPreview) {
        displayText += textPreview.length < element.textContent.trim().length ? 
          textPreview + '...' : textPreview;
      }
    }
    
    displayText += `</${tagName}>`;
    
    return displayText;
  }

  // Function to create element info
  function createElementInfo(element) {
    const rect = element.getBoundingClientRect();
    
    return {
      tagName: element.tagName,
      className: getElementClassName(element),
      id: element.id || '',
      textContent: element.textContent?.slice(0, 100) || '',
      styles: getRelevantStyles(element),
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left
      },
      // Add new readable formats
      selector: createReadableSelector(element),
      displayText: createElementDisplayText(element),
      elementPath: getElementPath(element)
    };
  }

  // Helper function to get element class name consistently
  function getElementClassName(element) {
    if (!element.className) return '';
    
    if (typeof element.className === 'string') {
      return element.className;
    } else if (element.className.baseVal !== undefined) {
      return element.className.baseVal;
    } else {
      return element.className.toString();
    }
  }

  // Function to get element path (breadcrumb)
  function getElementPath(element) {
    const path = [];
    let current = element;
    
    while (current && current !== document.body && current !== document.documentElement) {
      let pathSegment = current.tagName.toLowerCase();
      
      if (current.id) {
        pathSegment += `#${current.id}`;
      } else if (current.className) {
        const className = getElementClassName(current);
        if (className.trim()) {
          const firstClass = className.trim().split(/\s+/)[0];
          pathSegment += `.${firstClass}`;
        }
      }
      
      path.unshift(pathSegment);
      current = current.parentElement;
      
      // Limit path length
      if (path.length >= 5) break;
    }
    
    return path.join(' > ');
  }

  // Event handlers
  function handleMouseMove(e) {
    if (!isInspectorActive) return;
    
    const target = e.target;
    if (!target || target === document.body || target === document.documentElement) return;

    // Remove previous highlight
    if (currentHighlight) {
      currentHighlight.classList.remove('inspector-highlight');
    }
    
    // Add highlight to current element
    target.classList.add('inspector-highlight');
    currentHighlight = target;

    const elementInfo = createElementInfo(target);
    
    // Send message to parent
    window.parent.postMessage({
      type: 'INSPECTOR_HOVER',
      elementInfo: elementInfo
    }, '*');
  }

  function handleClick(e) {
    if (!isInspectorActive) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target;
    if (!target || target === document.body || target === document.documentElement) return;

    const elementInfo = createElementInfo(target);
    
    // Send message to parent
    window.parent.postMessage({
      type: 'INSPECTOR_CLICK',
      elementInfo: elementInfo
    }, '*');
  }

  function handleMouseLeave() {
    if (!isInspectorActive) return;
    
    // Remove highlight
    if (currentHighlight) {
      currentHighlight.classList.remove('inspector-highlight');
      currentHighlight = null;
    }
    
    // Send message to parent
    window.parent.postMessage({
      type: 'INSPECTOR_LEAVE'
    }, '*');
  }

  // Function to activate/deactivate inspector
  function setInspectorActive(active) {
    isInspectorActive = active;
    
    if (active) {
      // Add inspector styles
      if (!inspectorStyle) {
        inspectorStyle = document.createElement('style');
        inspectorStyle.textContent = `
          .inspector-active * {
            cursor: crosshair !important;
          }
          .inspector-highlight {
            outline: 2px solid #3b82f6 !important;
            outline-offset: -2px !important;
            background-color: rgba(59, 130, 246, 0.1) !important;
          }
        `;
        document.head.appendChild(inspectorStyle);
      }
      
      document.body.classList.add('inspector-active');
      
      // Add event listeners
      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('mouseleave', handleMouseLeave, true);
    } else {
      document.body.classList.remove('inspector-active');
      
      // Remove highlight
      if (currentHighlight) {
        currentHighlight.classList.remove('inspector-highlight');
        currentHighlight = null;
      }
      
      // Remove event listeners
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('mouseleave', handleMouseLeave, true);
      
      // Remove styles
      if (inspectorStyle) {
        inspectorStyle.remove();
        inspectorStyle = null;
      }
    }
  }

  // Listen for messages from parent
  window.addEventListener('message', function(event) {
    if (event.data.type === 'INSPECTOR_ACTIVATE') {
      setInspectorActive(event.data.active);
    }
    if (event.data.type === 'CAPTURE_SCREENSHOT') {
      captureScreenshot(event.data.requestId);
    }
  });

  // Auto-inject if inspector is already active
  window.parent.postMessage({ type: 'INSPECTOR_READY' }, '*');

  // --- 생성물 자동 검토 2단계: 시각 검토용 스크린샷 캡처 ---
  // 부모(Preview.tsx)가 CAPTURE_SCREENSHOT을 보내기 전에 이미 iframe을 1280x800으로 리사이즈해둔
  // 상태라고 가정한다 — 그래서 window.innerWidth/innerHeight를 그대로 쓴다(하드코딩 안 함). 라이브러리는
  // 이 메시지를 처음 받을 때만 지연 로드한다 — 검토를 안 받는 대다수 미리보기는 이 비용을 전혀 안 씀.
  var htmlToImageLoadPromise = null;

  function loadHtmlToImage() {
    if (htmlToImageLoadPromise) {
      return htmlToImageLoadPromise;
    }

    htmlToImageLoadPromise = new Promise(function (resolve, reject) {
      if (window.htmlToImage) {
        resolve(window.htmlToImage);
        return;
      }

      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js';
      script.onload = function () {
        if (window.htmlToImage) {
          resolve(window.htmlToImage);
        } else {
          reject(new Error('html-to-image loaded but window.htmlToImage missing'));
        }
      };
      script.onerror = function () {
        reject(new Error('failed to load html-to-image from CDN'));
      };
      document.head.appendChild(script);
    });

    return htmlToImageLoadPromise;
  }

  /*
   * 레이아웃(겹침/간격/기준선 등)만 보면 되고 이미지 내용은 검토 대상이 아니다 — 그래서 캡처 전에
   * 모든 <img>의 src를 같은 크기의 회색 placeholder로 바꿔서, placehold.co 같은 외부 이미지를 절대
   * fetch하지 않는다(캔버스 오염 방지, 방법 2/3 조사에서 확인한 문제). 성공/실패 관계없이 원래 src로
   * 반드시 복원한다.
   */
  function withBlankedImages(fn) {
    var imgs = Array.prototype.slice.call(document.querySelectorAll('img'));
    var originalSrcs = imgs.map(function (img) {
      return img.getAttribute('src');
    });
    var blank =
      'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#E5DED3"/></svg>');

    imgs.forEach(function (img) {
      img.setAttribute('src', blank);
    });

    var restore = function () {
      imgs.forEach(function (img, i) {
        if (originalSrcs[i] === null) {
          img.removeAttribute('src');
        } else {
          img.setAttribute('src', originalSrcs[i]);
        }
      });
    };

    return fn().then(
      function (result) {
        restore();
        return result;
      },
      function (err) {
        restore();
        throw err;
      },
    );
  }

  function captureScreenshot(requestId) {
    loadHtmlToImage()
      .then(function (htmlToImage) {
        return withBlankedImages(function () {
          return htmlToImage.toJpeg(document.body, {
            width: window.innerWidth,
            height: window.innerHeight,
            quality: 0.7,
            backgroundColor: '#ffffff',
          });
        });
      })
      .then(function (dataUrl) {
        window.parent.postMessage({ type: 'SCREENSHOT_CAPTURED', requestId: requestId, dataUrl: dataUrl }, '*');
      })
      .catch(function (err) {
        window.parent.postMessage(
          { type: 'SCREENSHOT_FAILED', requestId: requestId, reason: (err && err.message) || String(err) },
          '*',
        );
      });
  }

  // --- Vite compile-error / first-successful-render detection ---
  // Vite has no explicit "compiled OK" signal — it only speaks up when something breaks
  // (by appending a <vite-error-overlay> custom element to the document). So "OK" here is
  // inferred positively (the app's #root actually got rendered into) rather than assumed
  // from silence, and reported once per overlay lifecycle to avoid spamming the parent.
  (function () {
    var compileErrorActive = false;
    var firstRenderConfirmed = false;

    function post(type, extra) {
      var payload = { type: type };
      if (extra) {
        for (var key in extra) {
          if (Object.prototype.hasOwnProperty.call(extra, key)) {
            payload[key] = extra[key];
          }
        }
      }
      window.parent.postMessage(payload, '*');
    }

    function extractOverlayInfo(overlayEl) {
      try {
        var root = overlayEl.shadowRoot;

        if (!root) {
          return { message: 'Vite compile error', stack: '' };
        }

        var messageEl = root.querySelector('.message-body') || root.querySelector('.message');
        var fileEl = root.querySelector('.file');
        var frameEl = root.querySelector('.frame');
        var message = ((messageEl && messageEl.textContent) || '').trim();
        var file = ((fileEl && fileEl.textContent) || '').trim();
        var frame = ((frameEl && frameEl.textContent) || '').trim();

        if (!message) {
          // Selectors didn't match this Vite version's overlay markup — fall back to raw text.
          message = ((root.textContent || 'Vite compile error').trim()).slice(0, 500);
        }

        return { message: message, stack: [file, frame].filter(Boolean).join('\n').slice(0, 4000) };
      } catch (e) {
        return { message: 'Vite compile error', stack: '' };
      }
    }

    function findOverlay(node) {
      if (!node || node.nodeType !== 1) {
        return null;
      }

      if (node.tagName && node.tagName.toLowerCase() === 'vite-error-overlay') {
        return node;
      }

      return node.querySelector ? node.querySelector('vite-error-overlay') : null;
    }

    function confirmFirstRender() {
      if (firstRenderConfirmed || compileErrorActive) {
        return;
      }

      firstRenderConfirmed = true;
      post('VITE_COMPILE_OK');
    }

    function onOverlayAdded(overlayEl) {
      if (compileErrorActive) {
        return;
      }

      compileErrorActive = true;

      var info = extractOverlayInfo(overlayEl);
      post('VITE_COMPILE_ERROR', { message: info.message, stack: info.stack });
    }

    function onOverlayRemoved() {
      if (!compileErrorActive) {
        return;
      }

      compileErrorActive = false;
      confirmFirstRender();
    }

    var overlayObserver = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var addedNodes = mutations[i].addedNodes;

        for (var j = 0; j < addedNodes.length; j++) {
          var added = findOverlay(addedNodes[j]);

          if (added) {
            onOverlayAdded(added);
          }
        }

        var removedNodes = mutations[i].removedNodes;

        for (var k = 0; k < removedNodes.length; k++) {
          var removed = findOverlay(removedNodes[k]);

          if (removed) {
            onOverlayRemoved();
          }
        }
      }
    });

    overlayObserver.observe(document.documentElement, { childList: true, subtree: true });

    var existingOverlay = document.querySelector('vite-error-overlay');

    if (existingOverlay) {
      onOverlayAdded(existingOverlay);
    }

    // Positive signal: the app's root container actually received content.
    function watchRootMount() {
      var root = document.getElementById('root');

      if (!root) {
        // index.html may still be parsing — retry shortly instead of giving up.
        setTimeout(watchRootMount, 50);
        return;
      }

      if (root.childNodes.length > 0) {
        confirmFirstRender();
        return;
      }

      var rootObserver = new MutationObserver(function () {
        if (root.childNodes.length > 0) {
          confirmFirstRender();
          rootObserver.disconnect();
        }
      });
      rootObserver.observe(root, { childList: true });
    }

    watchRootMount();

    // Fallback for the case where main.tsx is broken badly enough that Vite can't even
    // serve it and the HMR socket never connects — so the overlay never appears either.
    document.addEventListener(
      'error',
      function (event) {
        var target = event.target;

        if (!target || target.tagName !== 'SCRIPT' || target.type !== 'module') {
          return;
        }

        if (compileErrorActive) {
          return;
        }

        compileErrorActive = true;
        post('VITE_COMPILE_ERROR', {
          message: 'Entry script failed to load: ' + (target.getAttribute('src') || 'unknown'),
          stack: '',
        });
      },
      true,
    );
  })();
})();