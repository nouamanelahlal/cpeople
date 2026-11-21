<#ftl output_format="HTML">
<#--
  The CPeople e-mail card, used by every HTML e-mail in this theme.

  Styles are inline because mail clients drop stylesheets, and the ConSAP colours
  are repeated here for the same reason — a mail client cannot reach packages/ui.
  Overrides Keycloak's base macro of the same name, so a stock e-mail we have not
  reworded still arrives looking like ours.
-->
<#macro emailLayout>
<html>
<body style="margin:0;padding:0;background:#F0F0F0;font-family:'Montserrat',Arial,Helvetica,sans-serif;color:#4E566B">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0F0F0;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E3E7EE;border-radius:16px;padding:32px">
          <tr>
            <td style="font-size:22px;font-weight:300;color:#0F1937;padding-bottom:8px">
              CPeople
            </td>
          </tr>
          <tr>
            <td style="font-size:15px;line-height:1.6">
              <#nested>
            </td>
          </tr>
          <tr>
            <td style="font-size:12px;line-height:1.6;color:#4E566B;padding-top:24px;border-top:1px solid #E3E7EE">
              CPeople by ConSAP
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
</#macro>
