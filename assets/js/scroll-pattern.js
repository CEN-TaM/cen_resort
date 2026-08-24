// sticky-header / tabbar 사이를 .scroll-body 로 래핑
// session 02 패턴: sticky-header / tabbar 사이 콘텐츠를 .scroll-body로 래핑
(function setupScrollPattern() {
  document.querySelectorAll('.screen').forEach(screenEl => {
    if (screenEl.querySelector(':scope > .scroll-body')) return;
    const header = screenEl.querySelector(':scope > .sticky-header');
    const tabbar = screenEl.querySelector(':scope > .tabbar');
    const wrapper = document.createElement('div');
    wrapper.className = 'scroll-body';
    const startAfter = header || null;
    let nodes;
    if (startAfter) {
      nodes = [];
      let next = startAfter.nextSibling;
      while (next && next !== tabbar) {
        nodes.push(next);
        next = next.nextSibling;
      }
    } else {
      nodes = Array.from(screenEl.children).filter(n => n !== tabbar);
    }
    nodes.forEach(n => wrapper.appendChild(n));
    if (wrapper.children.length) {
      if (startAfter) startAfter.insertAdjacentElement('afterend', wrapper);
      else if (tabbar) tabbar.insertAdjacentElement('beforebegin', wrapper);
      else screenEl.appendChild(wrapper);
    }
  });
})();
