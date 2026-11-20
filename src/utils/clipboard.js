// Copy text and report whether the copy succeeded. No message is sent.
export const copyToClipboard = async (str) => {
  try {
    await navigator.clipboard.writeText(str);
    return true;
  } catch (error) {
    let ta;
    try {
      ta = document.createElement('textarea');
      ta.value = str;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      return document.execCommand('copy');
    } catch (fallbackError) {
      return false;
    } finally {
      if (ta && ta.parentNode) ta.parentNode.removeChild(ta);
    }
  }
};
